import assert from "node:assert/strict";
import fs from "node:fs";
import * as nodeModule from "node:module";
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

/**
 * What a host reports for the broken contract input: the source plugin's own
 * error, or, with the linked plugin, the compiler's verdict on the input's
 * syntax, which it reports before any plugin runs.
 */
export const BROKEN_INPUT = /invalid contract type|Type expected/;

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
 *
 * `plugin` selects the transform plugin the tsconfig names: `"source"`, the
 * standalone Go process whose envelope carries no compiler graph, or
 * `"linked"`, the contributor to ttsc's utility host, whose compile goes
 * through TypeScript-Go's program and whose envelope carries the compiler's
 * verdict, graph, and resolution candidates.
 */
export function fixture(name, { linked = false, plugin = "source" } = {}) {
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
  const external = externalDirectory(root);
  fs.rmSync(external, { recursive: true, force: true });
  write(
    root,
    "package.json",
    JSON.stringify({ private: true, type: "module" }),
  );
  writeBaseTsconfig(root, undefined, plugin);
  writeTsconfig(root, undefined, plugin);
  write(root, "src/globals.d.ts", "declare function watchValue(): string;\n");
  writeMain(root);
  write(root, "src/deps/local.d.ts", localDeclaration("ok"));
  write(external, "shape.d.ts", shapeDeclaration("ok"));
  for (const i of [1, 2, 3])
    write(root, `src/mod${i}.ts`, "export const value = watchValue();\n");
  const project = projectAt(root, { linked, physical, plugin });
  project.change("FIRST");
  return project;
}

/**
 * The directory beside the project that holds its external input: a declaration
 * the entry imports from outside the project root, so the compiler lists it as
 * an input the project does not contain.
 */
function externalDirectory(root) {
  return path.join(path.dirname(root), `${path.basename(root)}-external`);
}

/**
 * The entry module: the three consumers, a value of its own, and two type-only
 * imports the bundler never sees, one from a directory inside the project and
 * one from the external directory beside it; with `later`, a third import of a
 * declaration that does not exist until a scenario creates it.
 */
function writeMain(root, { later = false } = {}) {
  write(
    root,
    "src/main.ts",
    [
      ...[1, 2, 3].map(
        (i) => `import { value as value${i} } from "./mod${i}.ts";`,
      ),
      'import type { Local } from "./deps/local";',
      `import type { Shape } from "../../${path.basename(root)}-external/shape";`,
      ...(later ? ['import type { Later } from "./later";'] : []),
      "export const value = watchValue();",
      'export const local: Local = "ok";',
      'export const shape: Shape = "ok";',
      ...(later ? ['export const later: Later = "ok";'] : []),
      "console.log(value, value1, value2, value3);",
    ].join("\n"),
  );
}

/** A declaration whose only export is the literal type `value`. */
function localDeclaration(value) {
  return `export type Local = ${JSON.stringify(value)};\n`;
}

/** A declaration whose only export is the literal type `value`. */
function shapeDeclaration(value) {
  return `export type Shape = ${JSON.stringify(value)};\n`;
}

/**
 * The project's tsconfig, which extends the base config beside it; `fixed`
 * overrides the base's plugin entry with one that makes the plugin replace
 * every consumer's value with it, so an edit to the tsconfig itself has an
 * observable effect.
 */
function writeTsconfig(root, fixed, plugin) {
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      extends: "./tsconfig.base.json",
      compilerOptions:
        fixed === undefined ? {} : { plugins: [pluginEntry(plugin, fixed)] },
      include: ["src", "app", "pages"],
      exclude: ["dist-contract", "node_modules"],
    }),
  );
}

/**
 * The base config the project's tsconfig extends, holding the compiler options
 * and the transform plugin entry; `fixed` fixes every consumer's value from
 * here, so an edit to a config reached only through the `extends` chain has an
 * observable effect too.
 */
function writeBaseTsconfig(root, fixed, plugin) {
  write(
    root,
    "tsconfig.base.json",
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        types: [],
        jsx: "preserve",
        outDir: "dist-contract",
        // TypeScript 6 refuses an `outDir` whose `rootDir` it would have to
        // infer; the external declaration lies outside it, which a
        // declaration may.
        rootDir: ".",
        // The consumers import each other with their `.ts` extension, as a
        // bundler-only project may once it emits nothing itself.
        allowImportingTsExtensions: true,
        noEmit: true,
        plugins: [pluginEntry(plugin, fixed)],
      },
    }),
  );
}

/**
 * The tsconfig entry of the transform plugin `plugin` names, fixing every value
 * when given.
 */
function pluginEntry(plugin, fixed) {
  return {
    transform: path.join(
      workspace,
      plugin === "linked" ? "unplugin-linked.cjs" : "unplugin-transform.cjs",
    ),
    ...(fixed === undefined ? {} : { fixed }),
  };
}

/**
 * The accessors of a fixture already on disk at `root`, for a process that did
 * not create it, such as the Bun worker.
 */
export function projectAt(
  root,
  { linked = false, physical = root, plugin = "source" } = {},
) {
  const input = path.join(root, "src/contract-input.server.ts");
  return {
    root,
    physical,
    linked,
    plugin,
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
      writeTsconfig(root, fixed, plugin);
    },
    /**
     * Rewrite the base config the tsconfig extends, fixing every consumer's
     * value when given.
     */
    configureBase(fixed) {
      writeBaseTsconfig(root, fixed, plugin);
    },
    /** Rewrite the local declaration the entry depends on, exporting `value`. */
    local(value) {
      write(root, "src/deps/local.d.ts", localDeclaration(value));
    },
    /** Rewrite the external declaration the entry depends on, exporting `value`. */
    shape(value) {
      write(externalDirectory(root), "shape.d.ts", shapeDeclaration(value));
    },
    /** Rewrite the entry, importing the declaration `src/later.d.ts` or not. */
    importLater(later) {
      writeMain(root, { later });
    },
    /** Create the declaration the entry imports once `importLater(true)` ran. */
    later() {
      write(root, "src/later.d.ts", 'export type Later = "ok";\n');
    },
    tsconfig: path.join(root, "tsconfig.json"),
    baseTsconfig: path.join(root, "tsconfig.base.json"),
    localDeclaration: path.join(root, "src/deps/local.d.ts"),
    depsDirectory: path.join(root, "src/deps"),
    externalDeclaration: path.join(externalDirectory(root), "shape.d.ts"),
    laterDeclaration: path.join(root, "src/later.d.ts"),
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

/**
 * The type-stripping stage a Rollup, webpack, or Rspack build needs after ttsc:
 * the adapter emits TypeScript, and those hosts compile none themselves, so a
 * user adds an esbuild- or swc-based stage after `ttsc()` (the setup guide says
 * so). The contract uses Node's own stripper, which keeps every position.
 */
export function stripTypes(code) {
  // Read at use, since the Bun worker imports this module and Bun's
  // `node:module` has no stripper; only a Node host strips.
  return nodeModule.stripTypeScriptTypes(code, { mode: "strip" });
}

/**
 * Write the type-stripping loader for a webpack or Rspack build, run after
 * ttsc's pre-enforced loader the way `writeRaceLoader`'s is.
 */
export function writeStripLoader(root) {
  const loader = path.join(root, "strip-loader.cjs");
  fs.writeFileSync(
    loader,
    [
      'const { stripTypeScriptTypes } = require("node:module");',
      "module.exports = function stripLoader(source) {",
      '  return stripTypeScriptTypes(source, { mode: "strip" });',
      "};",
    ].join(String.fromCharCode(10)),
  );
  return loader;
}

/**
 * Pay the linked plugin's host build once, outside any host's deadline: the
 * first compile with the linked plugin builds ttsc's utility host with the
 * contract's contributor, minutes on a cold Go cache, and every later compile
 * reuses that build.
 */
export async function warmLinkedPlugin() {
  const api = await import("@ttsc/unplugin/api");
  const project = fixture("warm-linked", { plugin: "linked" });
  await api.transformTtsc(
    project.entry,
    fs.readFileSync(project.entry, "utf8"),
    api.resolveOptions(project.options),
  );
  assert.equal(project.runs(), 1, "the linked plugin compiles");
}
