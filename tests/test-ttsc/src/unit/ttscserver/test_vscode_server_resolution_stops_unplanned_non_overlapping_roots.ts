import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies VS Code server planning stops unplanned non-overlapping roots.
 *
 * Closing the last document in one workspace root should stop that root's
 * language client even when another unrelated root still has an open document.
 * Otherwise the closed root leaves an idle `ttscserver` process behind until
 * deactivation.
 *
 * 1. Call the authored server resolution helper in the unit process.
 * 2. Create two unrelated running roots.
 * 3. Plan only the first root.
 * 4. Assert the second root is selected for shutdown.
 *
 * @evidence contracts/testing.md#behavioral-verification rootsToStopForPlan removes stale clients even when their paths do not overlap current roots.
 * @evidence contracts/testing.md#independent-expectations the planned client set owns which sessions remain, not just an overlap predicate.
 * @evidence contracts/testing.md#distinguishing-cases planned and stale independent roots produce the literal stale-client set.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_stops_unplanned_non_overlapping_roots function runs under src/unit/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_stops_unplanned_non_overlapping_roots() {
  const repo = TestProject.WORKSPACE_ROOT;
  const rootA = path.join(repo, "tmp", "root-a");
  const rootB = path.join(repo, "tmp", "root-b");
  const observed = (() => {
    return {
      stopped: mod.rootsToStopForPlan([(rootA), (rootB)], [(rootA)]),
    };
  
  })();
  const actual = observed as { stopped: string[] };
  assert.deepEqual(
    actual.stopped.map((entry) => path.normalize(entry)),
    [path.normalize(rootB)],
  );
}