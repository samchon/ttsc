import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx runs an entry the project's `include` excludes, without
 * widening what ttsc compiles.
 *
 * This is the difference between the two CLIs. `ttsc -p tsconfig.json` selects
 * a _file set_: a project whose `include` is `src` must put only `src` in
 * `lib`, and `build/release.ts`, `clear.ts`, or `lint.config.ts` beside the
 * tsconfig have no business there. `ttsx build/release.ts` selects an _entry_:
 * it needs the same project's compiler options, not its file list. ttsx used to
 * demand an emit for the entry from the whole-project build and abort with
 * "emitted entry not found", so no project script was runnable at all.
 *
 * 1. Create the ordinary layout: `src/**` plus `clear.ts`, `build/release.ts`, and
 *    `lint.config.ts` outside a `rootDir`/`include` of `src`.
 * 2. Run ttsc, then run ttsx against each out-of-`include` entry.
 * 3. Assert every entry ran, that `lib` still holds only the `src` emit, and that
 *    no synthesized tsconfig was left behind.
 */
export const test_ttsx_runs_an_entry_the_project_include_excludes = () => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({
      name: "outside-include",
      version: "1.0.0",
    }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        outDir: "lib",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/index.ts": `export const hello = (): string => "world";\n`,
    "clear.ts": `console.log("cleared");\n`,
    "build/release.ts": `console.log("released");\n`,
    "lint.config.ts": `export default { files: ["src/**/*.ts"], rules: {} };\n`,
  });

  const compiled = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "-p", "tsconfig.json"],
    { cwd: root },
  );
  assert.equal(compiled.status, 0, compiled.stderr);
  assert.deepEqual(fs.readdirSync(path.join(root, "lib")).sort(), ["index.js"]);

  for (const [entry, expected] of [
    ["clear.ts", "cleared"],
    ["build/release.ts", "released"],
  ] as const) {
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, entry],
      { cwd: root },
    );
    assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
    assert.equal(result.stdout.trim(), expected);
  }

  assert.deepEqual(fs.readdirSync(path.join(root, "lib")).sort(), ["index.js"]);
  assert.deepEqual(
    fs.readdirSync(root).filter((name) => name.startsWith(".ttsx-entry")),
    [],
  );
};
