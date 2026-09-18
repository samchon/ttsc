import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx runs the entry as Node's own main module, with the process
 * semantics `node <entry>` gives it.
 *
 * Pins samchon/ttsc#1402. ttsx used to start a bootstrap as the main module and
 * load the entry from it, so in the entry `require.main === module` was false,
 * `import.meta.main` was false, an error thrown while the entry evaluated was
 * caught by the bootstrap before `process.on("uncaughtException")` could see
 * it, and a `main()` guarded by `require.main === module` silently never ran.
 * The entry is now what Node runs.
 *
 * 1. Create a CommonJS entry, an ES module entry that imports a helper, an entry
 *    that handles its own uncaught error, and entries that exit with a code,
 *    throw, or reject a top-level await.
 * 2. Run each through ttsx.
 * 3. Assert the main-module answers, `process.argv[1]`, the handled error, and the
 *    exit codes match what `node` gives.
 */
export const test_ttsx_runs_the_entry_as_the_main_module = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "main-module", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        outDir: "lib",
        types: [],
      },
      include: ["src"],
    }),
    "src/cjs.ts": [
      `declare const require: { main: unknown };`,
      `declare const module: unknown;`,
      `declare const process: { argv: string[] };`,
      `console.log(JSON.stringify({ main: require.main === module, argv1: process.argv[1] }));`,
      `export {};`,
      ``,
    ].join("\n"),
    "src/helper.mts": `export const helperMain: unknown = (import.meta as { main?: unknown }).main;\n`,
    "src/esm.mts": [
      `import { helperMain } from "./helper.mjs";`,
      `const main: unknown = (import.meta as { main?: unknown }).main;`,
      `console.log(JSON.stringify({ main, helperMain }));`,
      ``,
    ].join("\n"),
    "src/handled.ts": [
      `declare const process: { on(event: string, listener: (error: Error) => void): void };`,
      `declare function setTimeout(callback: () => void, ms: number): unknown;`,
      `process.on("uncaughtException", (error) => console.log("handled: " + error.message));`,
      `setTimeout(() => console.log("still alive"), 10);`,
      `throw new Error("boom");`,
      `export {};`,
      ``,
    ].join("\n"),
    "src/exit.ts": `declare const process: { exit(code: number): never };\nprocess.exit(7);\nexport {};\n`,
    "src/throws.ts": `throw new Error("unhandled");\nexport {};\n`,
    "src/rejects.mts": `await Promise.reject(new Error("rejected"));\nexport {};\n`,
  });
  const run = (entry: string) =>
    TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, entry], {
      cwd: root,
    });

  const cjs = run("src/cjs.ts");
  assert.equal(cjs.status, 0, cjs.stderr);
  const reported = JSON.parse(cjs.stdout.trim()) as {
    main: boolean;
    argv1: string;
  };
  assert.equal(reported.main, true);
  assert.equal(
    fs.realpathSync.native(reported.argv1).toLowerCase(),
    fs.realpathSync.native(path.join(root, "src", "cjs.ts")).toLowerCase(),
  );

  const esm = run("src/esm.mts");
  assert.equal(esm.status, 0, esm.stderr);
  const meta = JSON.parse(esm.stdout.trim()) as {
    main?: unknown;
    helperMain?: unknown;
  };
  // `import.meta.main` exists from Node 24.2; where it does, only the entry
  // is the main module.
  if (meta.main !== undefined) {
    assert.equal(meta.main, true);
    assert.equal(meta.helperMain, false);
  }

  const handled = run("src/handled.ts");
  assert.equal(handled.status, 0, handled.stderr);
  assert.deepEqual(handled.stdout.trim().split(/\r?\n/), [
    "handled: boom",
    "still alive",
  ]);

  assert.equal(run("src/exit.ts").status, 7);
  const thrown = run("src/throws.ts");
  assert.equal(thrown.status, 1, thrown.stdout);
  assert.match(thrown.stderr, /unhandled/);
  const rejected = run("src/rejects.mts");
  assert.equal(rejected.status, 1, rejected.stdout);
  assert.match(rejected.stderr, /rejected/);
};
