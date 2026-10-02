import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
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
 * @evidence contracts/testing.md#independent-expectations The expected stopped list is the authored second root: by the stated contract every running client missing from the plan must stop even when it does not overlap a planned root, so an overlap-only implementation would return an empty list.
 * @evidence contracts/testing.md#distinguishing-cases One running root that is in the plan is kept and one unrelated running root that is not in the plan is returned for shutdown. An empty plan, alias spellings and nested roots are covered by sibling tests or not at all.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it calls the actual selector over missing child paths in a fresh tracked temporary parent. Native absence assertions establish lexical fallback; no language client or child process starts.
 */
export function test_vscode_server_resolution_stops_unplanned_non_overlapping_roots() {
  const parent = TestProject.tmpdir("vscode-plan-membership-missing-roots-");
  const rootA = path.join(parent, "root-a");
  const rootB = path.join(parent, "root-b");
  for (const entry of [rootA, rootB]) assert.equal(fs.existsSync(entry), false);
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
