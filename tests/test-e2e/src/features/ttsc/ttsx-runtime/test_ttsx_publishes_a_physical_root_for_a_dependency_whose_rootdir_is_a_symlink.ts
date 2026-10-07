import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies a built dependency's published `rootDir` is the physical spelling of
 * the source path it will be compared against.
 *
 * The dependency lane looks a served source up by mirroring
 * `path.relative(rootDir, source)` into the emit directory, and the source
 * arrives through `fs.realpathSync.native`. A `rootDir` the owning tsconfig
 * declares is joined but never resolved, so a `rootDir` that is itself a
 * symlinked directory makes the pair two spellings of one place:
 * `path.relative` answers `../sources/index.ts`, the exact-mirror lane is
 * dropped, and every served file of that dependency falls to the trailing-stem
 * matcher, which rescans the whole emit tree per file. The marker the build
 * publishes carries that spelling, so the state outlives the process that wrote
 * it.
 *
 * The run still produces the right file either way, so the marker is what makes
 * this observable: a `rootDir` equal to its own physical path is exactly the
 * property the lookup needs.
 *
 * Both branches are covered. One dependency declares `rootDir: "src"`, a
 * symlink to the real `sources` directory, which diverges on every platform.
 * The other declares no `rootDir` at all and falls back to the project root,
 * which diverges only on Windows, where the runner's temp root carries an 8.3
 * component that plain `fs.realpathSync` keeps and `fs.realpathSync.native`
 * expands.
 *
 * 1. Install those two dependencies.
 * 2. Run ttsx against an entry that requires both, then prints every dependency
 *    marker's `rootDir`.
 * 3. Assert both dependencies ran and every published `rootDir` is its own
 *    physical path.
 *
 * @evidence contracts/testing.md#behavioral-verification Loads dependencies with symlinked and ordinary roots and inspects the live manifest roots alongside dep-values output.
 * @evidence contracts/testing.md#independent-expectations fs.realpathSync.native independently checks that each of the two published root strings is physical; the fixture authors dep-values.
 * @evidence contracts/testing.md#distinguishing-cases Both roots must be physical, but the assertion does not assign each root to a particular dependency; failed link creation returns early.
 * Unavailable host capabilities return false so the runner reports SKIPPED without claiming this case executed its behavioral assertions.
 *
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Native dependency emission, manifest publication and Node require cross the real alias boundary in one running graph.
 * @evidence contracts/e2e.md#shared-execution One host compiles and loads both dependency forms; their project fixture and installed toolchain are shared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The live manifest is read during the host lifetime before runtime teardown; all sources and links belong to tracked temporary ownership.
 * @evidence contracts/e2e.md#preserved-coverage The two-root physical-spelling and output assertions remain here; exact root-to-dependency association and unavailable symlinks are not certified.
 */
export function test_ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink():
  | void
  | false {
  const root = TestProject.createProject(
    FixtureFiles.read(
      "ttsc/ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink/inputs-1",
    ),
  );
  try {
    fs.symlinkSync(
      path.join(root, "node_modules", "dep", "sources"),
      path.join(root, "node_modules", "dep", "src"),
      "junction",
    );
  } catch {
    // Without symlink permission the declared and physical spellings never
    // diverge, and the contract this pins cannot be exercised.
    return false;
  }

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /VALUE:dep-value\/dep2-value/);

  const line = result.stdout
    .split(/\r?\n/)
    .find((text) => text.startsWith("ROOTS:"));
  assert.notEqual(line, undefined, result.stdout);
  const roots = JSON.parse(line!.slice("ROOTS:".length)) as string[];
  assert.equal(
    roots.length,
    2,
    `the dependency lane did not publish a marker per dependency: ${result.stdout}`,
  );
  for (const published of roots) {
    assert.equal(
      fs.realpathSync.native(published),
      published,
      "a published dependency rootDir is not its own physical path, so the " +
        "exact-mirror lookup compares two spellings of one directory",
    );
  }
}
