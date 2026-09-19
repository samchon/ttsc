import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export const workspace = path.resolve(import.meta.dirname, "..");

/** Each host gets mutable inputs of its own and the same immutable Go source. */
export function fixture(name) {
  const root = path.join(workspace, ".contracts", name);
  assert.equal(path.dirname(root), path.join(workspace, ".contracts"));
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  write(
    root,
    "package.json",
    JSON.stringify({ private: true, type: "module" }),
  );
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
          { transform: path.join(workspace, "unplugin-transform.cjs") },
        ],
      },
      include: ["src", "app", "pages"],
      exclude: ["dist-contract", "node_modules"],
    }),
  );
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
  const input = path.join(root, "src/contract-input.server.ts");
  const change = (value) =>
    fs.writeFileSync(input, `export type ContractInput = "${value}";\n`);
  change("FIRST");
  return {
    root,
    input,
    change,
    break() {
      fs.writeFileSync(input, "export type ContractInput = ;\n");
    },
    entry: path.join(root, "src/main.ts"),
    output: path.join(root, "dist-contract/bundle.js"),
    options: { project: path.join(root, "tsconfig.json") },
    runs: () => fs.statSync(path.join(root, ".ttsc/contract-runs")).size,
  };
}

export function write(root, file, contents) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

export function expectOutput(code, value, consumers = 1) {
  const values = [
    ...code.matchAll(
      /(["'`])(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH)\1/g,
    ),
  ].map((match) => match[2]);
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

export async function eventually(read, predicate, label) {
  const until = Date.now() + 30_000;
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
 * Write a loader that runs after ttsc in a host's loader chain: the one place a
 * public API reaches between ttsc returning a module and the host taking its
 * dependencies (samchon/ttsc#1423). When the module it receives carries a
 * `LATE_RACE_<VALUE>` value, it rewrites the contract input holding that value
 * with `<VALUE>`, so the edit lands after ttsc registered the input and before
 * the host records its state.
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
          const values = [
            ...code.matchAll(
              /"(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH)"/g,
            ),
          ].map((match) => match[1]);
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
