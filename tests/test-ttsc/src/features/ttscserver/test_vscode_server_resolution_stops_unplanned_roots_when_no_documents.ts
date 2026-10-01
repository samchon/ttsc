import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies VS Code server planning stops stale roots when no roots are planned.
 *
 * Closing the last supported document can leave no planned client roots. In
 * that case the extension should stop existing language clients instead of
 * keeping idle `ttscserver` processes alive until deactivation.
 *
 * 1. Call the authored server resolution helper in the unit process.
 * 2. Ask which roots to stop when the planned-root set is empty.
 * 3. Ask which roots to stop when one overlapping parent root replaces a child.
 * 4. Assert every unplanned running root is stopped.
 *
 * @evidence contracts/testing.md#behavioral-verification rootsToStopForPlan stops all current clients when planning is empty.
 * @evidence contracts/testing.md#independent-expectations closing the last supported document leaves no planned language client.
 * @evidence contracts/testing.md#distinguishing-cases an empty plan stops both nested and unrelated clients; a replacement parent plan also stops both unplanned clients.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_stops_unplanned_roots_when_no_documents function runs under src/features/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_stops_unplanned_roots_when_no_documents() {
  const repo = TestProject.WORKSPACE_ROOT;
  const root = path.join(repo, "tmp", "repo");
  const nested = path.join(root, "packages", "demo");
  const unrelated = path.join(repo, "tmp", "outside-tools");
  const observed = (() => {
    return {
      empty: mod.rootsToStopForPlan([(nested), (unrelated)], []),
      parent: mod.rootsToStopForPlan([(nested), (unrelated)], [(root)]),
    };
  
  })();
  const actual = observed as {
    empty: string[];
    parent: string[];
  };
  assert.deepEqual(
    actual.empty.map((entry) => path.normalize(entry)),
    [path.normalize(nested), path.normalize(unrelated)],
  );
  assert.deepEqual(
    actual.parent.map((entry) => path.normalize(entry)),
    [path.normalize(nested), path.normalize(unrelated)],
  );
}