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
 * @evidence contracts/testing.md#independent-expectations The expected lists are authored literals from the contract that a running client absent from the plan must stop: with an empty plan every running root is returned, in input order.
 * @evidence contracts/testing.md#distinguishing-cases An empty plan returns both the nested and the unrelated running root; a plan holding only the parent root also returns both, because neither running root has the parent's identity (exact identity, not containment, keeps a client). No case here keeps a running client, which is covered by the sibling non-overlapping-roots test.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it calls rootsToStopForPlan with the default identity context over path strings that are never created on disk, with no fixture files, language client or child process.
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