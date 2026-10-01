import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
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
 * @evidence contracts/testing.md#independent-expectations The expected list is the single authored nested path: a client rooted below the removed workspace must stop and a client in another workspace must remain, which follows from the removal contract rather than from the helper's containment code.
 * @evidence contracts/testing.md#distinguishing-cases A nested client below the removed root is selected and an unrelated sibling directory (tmp/other next to tmp/repo) is not. The removed root itself in the list and an alias or case-variant spelling are not covered.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it calls rootsInsideRemovedWorkspace with the default identity context over three path strings that are never created on disk (identity falls back to lexical containment), with no fixture files, language client or child process.
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