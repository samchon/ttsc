import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export const workspace = path.resolve(import.meta.dirname, "..");

/**
 * The values a contract input can carry, in the order the scenarios use them. A
 * host's output is read for exactly these words, so a string literal of the
 * host's own never counts as a consumer's value.
 */
export const VALUES = [
  "FIRST",
  "SECOND",
  "THIRD",
  "FOURTH",
  "FIFTH",
  "SIXTH",
  "SEVENTH",
  "EIGHTH",
  "NINTH",
  "TENTH",
  "ELEVENTH",
  "TWELFTH",
  "THIRTEENTH",
  "FOURTEENTH",
  "FIFTEENTH",
  "CONFIGURED",
  "RUNTIME_FIRST",
  "RUNTIME_SECOND",
];

const VALUE_PATTERN = new RegExp(`(["'\`])(${VALUES.join("|")})\\1`, "g");

/**
 * Each host gets mutable inputs of its own and the same immutable Go source.
 *
 * With `linked`, the project's files live in a directory the host never names:
 * the host is configured through a link to it, a junction on Windows and a
 * symbolic link elsewhere, the way every macOS temporary directory and every
 * linked workspace names a project. The compiler then reports the project's
 * inputs under the physical directory while the host, and the contract, name it
 * through the link.
 */
export function fixture(name, { linked = false } = {}) {
  const physical = path.join(workspace, ".contracts", name);
  assert.equal(path.dirname(physical), path.join(workspace, ".contracts"));
  fs.rmSync(physical, { recursive: true, force: true });
  const link = path.join(workspace, ".contracts", `${name}-link`);
  fs.rmSync(link, { recursive: true, force: true });
  fs.mkdirSync(path.join(physical, "src"), { recursive: true });
  if (linked) {
    fs.symlinkSync(
      physical,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  const root = linked ? link : physical;
  write(
    root,
    "package.json",
    JSON.stringify({ private: true, type: "module" }),
  );
  writeTsconfig(root);
  write(root, "src/globals.d.ts", "declare function watchValue(): string;\n");
  write(
    root,
    "src/main.ts",
    [
      ...[1, 2, 3].map(
        (i) => `import { value as value${i} } from "./mod${i}.ts";`,
      ),
      "export const value = watchValue();",
      "console.log(value, value1, value2, value3);",
    ].join("\n"),
  );
  for (const i of [1, 2, 3])
    write(root, `src/mod${i}.ts`, "export const value = watchValue();\n");
  const project = projectAt(root, { linked, physical });
  project.change("FIRST");
  return project;
}

/**
 * The project's tsconfig, with the transform plugin entry; `fixed` makes the
 * plugin replace every consumer's value with it, so an edit to the tsconfig
 * itself has an observable effect.
 */
function writeTsconfig(root, fixed) {
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        types: [],
        jsx: "preserve",
        outDir: "dist-contract",
        plugins: [
          {
            transform: path.join(workspace, "unplugin-transform.cjs"),
            ...(fixed === undefined ? {} : { fixed }),
          },
        ],
      },
      include: ["src", "app", "pages"],
      exclude: ["dist-contract", "node_modules"],
    }),
  );
}

/**
 * The accessors of a fixture already on disk at `root`, for a process that did
 * not create it, such as the Bun worker.
 */
export function projectAt(root, { linked = false, physical = root } = {}) {
  const input = path.join(root, "src/contract-input.server.ts");
  return {
    root,
    physical,
    linked,
    input,
    change(value) {
      fs.writeFileSync(input, contractInput(value));
    },
    break() {
      fs.writeFileSync(input, "export type ContractInput = ;\n");
    },
    /** Remove the input outright, as a deleted file does. */
    remove() {
      fs.rmSync(input, { force: true });
    },
    /**
     * Save the input the way an editor does: write the whole file beside it and
     * rename it over the old one, so the watcher hears a creation and a rename,
     * never a write to the input's own path.
     */
    save(value) {
      const temporary = `${input}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, contractInput(value));
      fs.renameSync(temporary, input);
    },
    /** A second input the module depends on for the first time. */
    sibling(name, value) {
      write(root, `src/${name}-input.server.ts`, contractInput(value));
    },
    /** The path of a second input. */
    siblingPath(name) {
      return path.join(root, `src/${name}-input.server.ts`);
    },
    /** Rewrite the tsconfig, fixing every consumer's value when given. */
    configure(fixed) {
      writeTsconfig(root, fixed);
    },
    tsconfig: path.join(root, "tsconfig.json"),
    entry: path.join(root, "src/main.ts"),
    output: path.join(root, "dist-contract/bundle.js"),
    options: { project: path.join(root, "tsconfig.json") },
    runs: () => {
      try {
        return fs.statSync(path.join(root, ".ttsc/contract-runs")).size;
      } catch {
        return 0;
      }
    },
  };
}

/** The source of a contract input carrying `value`. */
export function contractInput(value) {
  return `export type ContractInput = "${value}";\n`;
}

export function write(root, file, contents) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

/** The values the consumers in `code` carry, in order. */
export function valuesIn(code) {
  return [...code.matchAll(VALUE_PATTERN)].map((match) => match[2]);
}

export function expectOutput(code, value, consumers = 1) {
  const values = valuesIn(code);
  assert.equal(
    values.length,
    consumers,
    `every consumer must retain its observable transformed value: ${code.slice(0, 500)}`,
  );
  assert.deepEqual(values, Array(consumers).fill(value));
  assert.ok(
    !code.includes("watchValue()"),
    "the transform must execute, not merely build successfully",
  );
}

/** Deadlines diagnose a missing event; successful runs pay no fixed sleep. */
export async function deadline(promise, label, milliseconds = 60_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out: ${label}`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function eventQueue() {
  const values = [];
  const waiters = [];
  return {
    push(value) {
      const waiter = waiters.shift();
      if (waiter) waiter(value);
      else values.push(value);
    },
    async next(label) {
      const value = values.length
        ? values.shift()
        : await deadline(
            new Promise((resolve) => waiters.push(resolve)),
            label,
          );
      if (value instanceof Error) throw value;
      return value;
    },
  };
}

export async function eventually(
  read,
  predicate,
  label,
  milliseconds = 30_000,
) {
  const until = Date.now() + milliseconds;
  let last;
  while (Date.now() < until) {
    try {
      last = await read();
      if (predicate(last)) return last;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `${label}: ${last instanceof Error ? last.stack : String(last).slice(0, 1000)}`,
  );
}

export async function adapter(name, options) {
  return (await import(`@ttsc/unplugin/${name}`)).default(options);
}

/**
 * Rewrite the contract input that holds a `LATE_RACE_<VALUE>` value with
 * `<VALUE>`, when `source` carries one: the edit a host seam placed after ttsc
 * makes, so it lands after ttsc registered the input and returned the module,
 * while the host is still building (samchon/ttsc#1423, samchon/ttsc#1460).
 *
 * A seam that sees no module code, the resolution of the module's imports under
 * esbuild and Bun, passes no source, and every input holding such a value is
 * rewritten: the module ttsc just returned carried it, since the compile read
 * that input.
 *
 * @returns Whether an input was rewritten.
 */
export function landLateRace(root, source) {
  const directory = path.join(root, "src");
  let landed = false;
  for (const name of fs.readdirSync(directory)) {
    if (!name.endsWith("-input.server.ts")) continue;
    const file = path.join(directory, name);
    const text = fs.readFileSync(file, "utf8");
    const match = /"LATE_RACE_([A-Z]+)"/.exec(source ?? text);
    if (match === null || !text.includes(match[0])) continue;
    fs.writeFileSync(file, contractInput(match[1]));
    landed = true;
  }
  return landed;
}

/**
 * Write a loader that runs after ttsc in a host's loader chain: the one place a
 * public API reaches between ttsc returning a module and the host taking its
 * dependencies (samchon/ttsc#1423). It lands a `LATE_RACE_<VALUE>` edit the way
 * `landLateRace` does.
 */
export function writeRaceLoader(root) {
  const loader = path.join(root, "race-loader.cjs");
  fs.writeFileSync(
    loader,
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      "module.exports = function raceLoader(source) {",
      '  const match = /"LATE_RACE_([A-Z]+)"/.exec(source);',
      "  if (match === null) return source;",
      '  const directory = path.join(this.rootContext, "src");',
      "  for (const name of fs.readdirSync(directory)) {",
      '    if (!name.endsWith("-input.server.ts")) continue;',
      "    const file = path.join(directory, name);",
      '    if (!fs.readFileSync(file, "utf8").includes(match[0])) continue;',
      '    fs.writeFileSync(file, "export type ContractInput = " + JSON.stringify(match[1]) + ";" + String.fromCharCode(10));',
      "  }",
      "  return source;",
      "};",
    ].join("\n"),
  );
  return loader;
}

/**
 * Wait for the build in which every consumer carries exactly `value`, and
 * return it.
 *
 * How many builds a host emits for one edit is the host's to decide: one can
 * report a build already queued before the edit reached its watcher, or emit a
 * partial build and then the rest. The contract asks only whether the host
 * converges on the edited state, which it either does, or never does. A defect
 * therefore surfaces as a deadline, never as a build caught mid-way, and the
 * error names every build seen while waiting, failed ones included, so a host
 * that converged on a mix is told apart from one that never rebuilt or that
 * kept failing.
 */
export async function settledOutput(events, label, value, consumers = 4) {
  const seen = [];
  try {
    return await deadline(
      (async () => {
        for (;;) {
          let code;
          try {
            code = await events.next(label);
          } catch (error) {
            // A build that failed on the way is not the converged state either;
            // a host that only ever fails runs out the deadline. The queue's
            // own deadline is that deadline, not a failed build.
            if (String(error.message).startsWith("Timed out:")) throw error;
            seen.push(String(error.message ?? error).split("\n")[0]);
            continue;
          }
          const values = valuesIn(code);
          seen.push(values);
          if (
            values.length === consumers &&
            values.every((found) => found === value)
          )
            return code;
        }
      })(),
      label,
    );
  } catch (error) {
    throw new Error(
      `${error.message}; builds seen while waiting: ${JSON.stringify(seen)}`,
    );
  }
}

/**
 * Wait for the next failed build whose error matches `pattern`, and return it.
 * A successful build seen on the way is not the failure either; the queue's
 * deadline bounds the wait.
 */
export async function failedOutput(events, label, pattern) {
  const seen = [];
  try {
    return await deadline(
      (async () => {
        for (;;) {
          try {
            seen.push(valuesIn(await events.next(label)));
          } catch (error) {
            if (String(error.message).startsWith("Timed out:")) throw error;
            if (pattern.test(String(error.message ?? error))) return error;
            seen.push(String(error.message ?? error).split("\n")[0]);
          }
        }
      })(),
      label,
    );
  } catch (error) {
    throw new Error(
      `${error.message}; builds seen while waiting: ${JSON.stringify(seen)}`,
    );
  }
}
