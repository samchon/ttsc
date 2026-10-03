import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies VS Code server planning rejects overlapping project roots.
 *
 * A parent language client with a recursive selector and a nested package
 * client would both claim the nested file. The pure resolution helper filters
 * ancestor candidates when a more specific descendant root is already known,
 * keeping one owner per document path.
 *
 * 1. Create a workspace root with a nested package, both with tsconfig files.
 * 2. Resolve candidates for an active file in the nested package.
 * 3. Filter overlapping candidates.
 * 4. Assert only the nested package root remains.
 *
 * @evidence contracts/testing.md#behavioral-verification createResolutionCandidates and filterNonOverlappingCandidates select the nested configured root.
 * @evidence contracts/testing.md#independent-expectations The expectation follows from the one-owner-per-document rule: the authored nested directory is the only root that may survive, and it is compared as a literal path rather than derived from the filter.
 * @evidence contracts/testing.md#distinguishing-cases The active file's nested config produces a nested candidate and the workspace root contributes a parent candidate; only the nested one is kept. A sibling-root case, an alias case and a no-nested-config case are not covered by this test.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_filters_overlapping_project_roots function runs under src/features/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_filters_overlapping_project_roots() {
  const repo = TestProject.WORKSPACE_ROOT;
  const root = TestProject.tmpdir("vscode-overlapping-roots-");
  const nested = path.join(root, "packages", "demo");
  fs.mkdirSync(path.join(nested, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "tsconfig.json"), "{}\n");
  fs.writeFileSync(path.join(nested, "tsconfig.json"), "{}\n");
  fs.writeFileSync(path.join(nested, "src", "main.ts"), "export {};\n");

  const observed = (() => {
    const candidates = mod.createResolutionCandidates({
      activeFile: (path.join(nested, "src", "main.ts")),
      activeWorkspaceRoot: (root),
      workspaceRoots: [(root)],
    });
    return mod.filterNonOverlappingCandidates(candidates).map((entry) => entry.cwd);
  
  })();
  assert.deepEqual(
    (observed as string[]).map((entry) =>
      path.normalize(entry),
    ),
    [path.normalize(nested)],
  );
}