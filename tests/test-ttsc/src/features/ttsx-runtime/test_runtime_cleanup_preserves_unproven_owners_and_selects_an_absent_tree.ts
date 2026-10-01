import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveRuntimeCleanTargets } from "../../../../../packages/ttsc/src/launcher/internal/runtime/resolveRuntimeCleanTargets";

/**
 * Verifies runtime cleanup removes only a tree whose runs have no unproven owner.
 *
 * Ownership uncertainty is not evidence that cleanup can remove a run.
 *
 * 1. Plan cleanup for a cache with no runtime tree and with an empty one and
 *    require the runtime directory as the only target.
 * 2. Add a legacy run directory and require it kept with no target.
 * 3. Add a run whose owner record is unparseable and require both runs kept with
 *    no target.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual resolveRuntimeCleanTargets selects an absent or empty runtime tree for removal, then preserves both a legacy unowned run and a malformed owner record with no deletion targets.
 * @evidence contracts/testing.md#independent-expectations Cleanup may remove a runtime tree with no runs, but cannot infer process death from a missing or unparsable owner record; literal independently authored run paths define the expected protected set.
 * @evidence contracts/testing.md#distinguishing-cases Missing index and empty index select the whole tree; one legacy run and the adjacent malformed owner run both block whole-tree deletion. Genuine child death and concurrent claim/clean behavior remain in real process-protocol E2E tests.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the authored cleanup planner directly on its isolated fixture filesystem. It starts no product host or compiler and builds no artifact; CLI reporting and actual explicit deletion remain in the shared public-clean E2E batch.
 */
export function test_runtime_cleanup_preserves_unproven_owners_and_selects_an_absent_tree(): void {
  const cache = TestProject.tmpdir("runtime-clean-plan-");
  const runtime = path.join(cache, "ttsx");
  const runs = path.join(runtime, "project");
  assert.deepEqual(resolveRuntimeCleanTargets(cache), {
    kept: [], targets: [runtime],
  });
  fs.mkdirSync(runs, { recursive: true });
  assert.deepEqual(resolveRuntimeCleanTargets(cache), {
    kept: [], targets: [runtime],
  });
  const legacy = path.join(fs.realpathSync.native(runs), "legacy");
  fs.mkdirSync(legacy);
  assert.deepEqual(resolveRuntimeCleanTargets(cache), {
    kept: [legacy], targets: [],
  });
  const unknown = path.join(fs.realpathSync.native(runs), "unknown");
  fs.mkdirSync(unknown);
  fs.writeFileSync(path.join(unknown, "owner-12.json"), "{", "utf8");
  const plan = resolveRuntimeCleanTargets(cache);
  assert.deepEqual([...plan.kept].sort(), [legacy, unknown].sort());
  assert.deepEqual(plan.targets, []);
}
