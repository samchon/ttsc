import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies VS Code workspace removal stops descendant server roots.
 *
 * A language client can be rooted at a nested tsconfig under the workspace
 * folder that was removed. Stopping only exact root matches would leave that
 * client alive after the owning workspace folder disappeared.
 *
 * 1. Call the authored server resolution helper in the unit process.
 * 2. Provide one removed workspace root with a nested client and a sibling.
 * 3. Ask which clients are inside the removed root.
 * 4. Assert the descendant is selected and the sibling is preserved.
 *
 * @evidence contracts/testing.md#behavioral-verification rootsInsideRemovedWorkspace returns clients below the removed workspace only.
 * @evidence contracts/testing.md#independent-expectations removing a workspace stops its descendant clients while independent workspaces retain ownership.
 * @evidence contracts/testing.md#distinguishing-cases a nested client below the removed root contrasts with an unrelated sibling client.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_removes_descendant_workspace_roots function runs under src/unit/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_removes_descendant_workspace_roots() {
  const repo = TestProject.WORKSPACE_ROOT;
  const removed = path.join(repo, "tmp", "repo");
  const nested = path.join(removed, "packages", "demo");
  const sibling = path.join(repo, "tmp", "other");
  const observed = (() => {
    return mod.rootsInsideRemovedWorkspace([
      (nested),
      (sibling)
    ], (removed));
  
  })();
  assert.deepEqual(
    (observed as string[]).map((entry) =>
      path.normalize(entry),
    ),
    [path.normalize(nested)],
  );
}