import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveSourceBuildCachePaths } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";
import { assertNoAncestorWorkspace } from "../../internal/assertNoAncestorWorkspace";

/**
 * Verifies cache paths: keeps an empty ttsc root as a project boundary.
 *
 * The first default-cache writer creates `.cache/ttsc` before it can publish
 * the workspace marker. A concurrent resolver must retain that in-progress
 * boundary instead of escaping to a populated ancestor during the short gap.
 * Native preparation first refuses an ambient ancestor workspace that would
 * legitimately outrank the two authored installation boundaries.
 *
 * 1. Create a populated outer install and an empty nested `.cache/ttsc` root.
 * 2. Resolve cache paths for the nested project during that pre-marker state.
 * 3. Assert the nested default root remains authoritative.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls resolveSourceBuildCachePaths for the nested `test` project, whose `node_modules/.cache/ttsc` exists but is empty while an outer `node_modules/dependency` exists, and asserts the returned root.
 * @evidence contracts/testing.md#independent-expectations The expected root is the authored nested `test/node_modules/.cache/ttsc` path: a cache directory that exists with nothing in it is the state a first writer creates before publishing its marker, so it must be treated as the project's own boundary rather than as absent evidence that sends the lookup to the outer installation.
 * @evidence contracts/testing.md#distinguishing-cases A single case: an empty nested ttsc root stays authoritative although a populated outer installation exists. The adjacent cases (a nested root holding only legacy payload, a root with a real dependency, a workspace marker) are covered by the sibling test_ttsc_cache_paths_ignores_only_a_ttsc_owned_node_modules_tree.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttsx-runtime; it calls resolveSourceBuildCachePaths with an empty env over directories created by TestProject.createProject (the placeholder file is removed to leave the empty root), and starts no CLI, compiler or process.
 */
export function test_ttsc_cache_paths_keeps_an_empty_ttsc_root_as_a_boundary() {
    const root = TestProject.createProject({
      "node_modules/dependency/package.json": JSON.stringify({
        name: "dependency",
      }),
      "test/main.ts": `export const value = 1;\n`,
      "test/node_modules/.cache/ttsc/.gitkeep": "",
      "test/tsconfig.json": JSON.stringify({
        compilerOptions: { outDir: "../dist", rootDir: "." },
        include: ["main.ts"],
      }),
    });
    assertNoAncestorWorkspace(fs.realpathSync.native(root));
    const ttscRoot = path.join(
      fs.realpathSync.native(root),
      "test",
      "node_modules",
      ".cache",
      "ttsc",
    );
    // `createProject` needs a file to materialize the directory; removing it
    // leaves the precise state between root creation and marker publication.
    fs.rmSync(path.join(ttscRoot, ".gitkeep"));

    assert.equal(
      resolveSourceBuildCachePaths(path.join(fs.realpathSync.native(root), "test"), undefined, {}).root,
      ttscRoot,
    );
}
