import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveSourceBuildCachePaths } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";

/**
 * Verifies cache paths: keeps an empty ttsc root as a project boundary.
 *
 * The first default-cache writer creates `.cache/ttsc` before it can publish
 * the workspace marker. A concurrent resolver must retain that in-progress
 * boundary instead of escaping to a populated ancestor during the short gap.
 *
 * 1. Create a populated outer install and an empty nested `.cache/ttsc` root.
 * 2. Resolve cache paths for the nested project during that pre-marker state.
 * 3. Assert the nested default root remains authoritative.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual source-build cache resolver interprets the fixture's installation and owned-cache boundaries and returns the asserted root without invoking the CLI.
 * @evidence contracts/testing.md#independent-expectations Expected native paths follow explicit fixture ownership: an installed dependency and workspace marker are authoritative, while a legacy ttsx-only payload is not an installation.
 * @evidence contracts/testing.md#distinguishing-cases An empty nested cache remains authoritative despite a populated outer installation, pinning the pre-marker publication boundary rather than treating emptiness as a legacy payload.
 * @evidence contracts/testing.md#execution-ownership The named source unit directly calls the maintained resolver using real fixture directories; CLI argument/output assembly remains with retained cache command boundary tests.
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
