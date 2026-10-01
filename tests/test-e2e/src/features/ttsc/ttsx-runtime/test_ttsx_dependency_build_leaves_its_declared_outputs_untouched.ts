import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies building a raw-TypeScript dependency through its own tsconfig writes
 * nothing into the dependency's declared output locations.
 *
 * The dependency lane builds the dependency's project into a private generation
 * directory. Its own `declarationDir` and `tsBuildInfoFile` name locations of
 * their own, so the build wrote `.d.ts` files and build information into the
 * dependency's tree, where a published package or a sibling workspace keeps its
 * real outputs (samchon/ttsc#1404). A root the dependency's project does not
 * include goes through a build of its own and must be isolated the same way.
 *
 * 1. Create a workspace `dep` whose tsconfig declares `declaration`,
 *    `declarationDir`, `composite`, and `tsBuildInfoFile`, with one included
 *    file and one outside `include`.
 * 2. Run an app entry that requires both.
 * 3. Assert both values arrive and `dep` holds no file it did not start with.
 * @evidence contracts/testing.md#behavioral-verification Ttsx requires dep/src/inside.ts and excluded dep/extra.ts, prints inside then extra, and leaves the dependency recursive sorted file paths exactly as before.
 * @evidence contracts/testing.md#independent-expectations Authored export values define runtime output; declarationDir/types and tsBuildInfoFile/state must receive no new files under a private runtime build.
 * @evidence contracts/testing.md#distinguishing-cases Included project emit and excluded-root fallback both use a composite/declaration-configured dependency. The file-list oracle detects added/removed paths but not replacement of existing file bytes.
 * @evidence contracts/testing.md#execution-ownership The discoverable named test_ttsx_dependency_build_leaves_its_declared_outputs_untouched entry belongs to the TypeScript E2E population and executes the actual launch/bootstrap path described here. Its fixture helpers do not register hidden assertion hosts; no portable unit owner is inferred without exact body comparison.
 * @evidence contracts/e2e.md#necessary-boundary Native dependency and fallback emit callbacks must isolate declaration/build-info publication while Node executes both sources. Direct output-option calculations cannot prove actual side effects.
 * @evidence contracts/e2e.md#shared-execution One consumer and dependency graph share one host with two requested sources. Different included/excluded compilation inputs retain their preparations rather than per-file consumer installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tree baseline is read before execution and after synchronous exit; sources remain immutable. TestProject tracks the fixture and runtime owns private generations.
 * @evidence contracts/e2e.md#preserved-coverage Original two runtime values and recursive file-list equality remain. This case does not claim byte identity of preexisting outputs; the separate published-output test owns hashes.
 */
export function test_ttsx_dependency_build_leaves_its_declared_outputs_untouched() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_dependency_build_leaves_its_declared_outputs_untouched/inputs-1"));
    const before = listTree(path.join(root, "dep"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/), ["inside", "extra"]);
    assert.deepEqual(listTree(path.join(root, "dep")), before);
  }

/** Every file below `directory`, as sorted `/` paths. */
function listTree(directory: string): string[] {
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const location = path.join(current, entry.name);
      if (entry.isDirectory()) walk(location);
      else
        files.push(
          path.relative(directory, location).split(path.sep).join("/"),
        );
    }
  };
  walk(directory);
  return files.sort();
}
