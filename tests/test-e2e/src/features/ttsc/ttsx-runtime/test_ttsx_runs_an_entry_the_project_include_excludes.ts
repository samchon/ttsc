import { FixtureFiles } from "../../../internal/FixtureFiles";
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
 * `src/release.ts` shares the entry's stem on purpose. Emitted-file lookup
 * falls back to matching trailing path segments, so without an ownership guard
 * the whole-project build's `release.js` answers for `build/release.ts` and
 * ttsx runs the wrong file — a failure that reports nothing at all.
 *
 * 1. Create the ordinary layout: `src/**` — including a same-stem `src/release.ts`
 *    — plus `clear.ts`, `build/release.ts`, and `lint.config.ts` outside a
 *    `rootDir`/`include` of `src`.
 * 2. Run ttsc, then run ttsx against each out-of-`include` entry.
 * 3. Assert every entry ran, that `lib` still holds only the `src` emit, and that
 *    no synthesized tsconfig was left behind.
 * @evidence contracts/testing.md#behavioral-verification Seeds lib with ttsc, then executes excluded clear and build/release through ttsx, requiring cleared/released while lib stays index/release only.
 * @evidence contracts/testing.md#independent-expectations The authored output literals and exact initial/final lib entry names distinguish selecting the compiled same-named release source.
 * @evidence contracts/testing.md#distinguishing-cases Two excluded entries are checked beside included sources; the lint.config.ts fixture is never invoked and supplies no lint-config execution coverage.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_an_entry_the_project_include_excludes at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary One real ttsc emission followed by two ttsx hosts connects included output preservation with excluded entry compilation and runtime loading.
 * @evidence contracts/e2e.md#shared-execution The three CLI calls share one project and compiler, retaining the seeded lib between entry runs instead of rebuilding independent fixtures.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Seeded output names and fixture sources remain stable; children complete before lib and .ttsx-entry prefix inspections, with tracked process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Both exact runtime values, lib-name equality and root-prefix absence remain here; no unused fixture is counted as an executed entry.
 */
export function test_ttsx_runs_an_entry_the_project_include_excludes() {
  const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_runs_an_entry_the_project_include_excludes/inputs-1"));

  const compiled = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "-p", "tsconfig.json"],
    { cwd: root },
  );
  assert.equal(compiled.status, 0, compiled.stderr);
  assert.deepEqual(fs.readdirSync(path.join(root, "lib")).sort(), [
    "index.js",
    "release.js",
  ]);

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

  assert.deepEqual(fs.readdirSync(path.join(root, "lib")).sort(), [
    "index.js",
    "release.js",
  ]);
  assert.deepEqual(
    fs.readdirSync(root).filter((name) => name.startsWith(".ttsx-entry")),
    [],
  );
}
