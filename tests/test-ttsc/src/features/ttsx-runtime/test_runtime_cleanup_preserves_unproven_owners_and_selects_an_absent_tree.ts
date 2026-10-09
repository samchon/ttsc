import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveRuntimeCleanTargets } from "../../../../../packages/ttsc/src/launcher/internal/runtime/resolveRuntimeCleanTargets";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the cleanup planner selects absent or empty trees and preserves
 * legacy and malformed-owner runs without selecting deletion targets.
 *
 * Ownership uncertainty is not evidence that cleanup can remove a run.
 *
 * 1. Plan cleanup for a cache with no runtime tree and with an empty one and
 *    require the runtime directory as the only target.
 * 2. Add a legacy run directory and require it kept with no target.
 * 3. Add a run whose owner record is unparseable and require both runs kept with
 *    no target.
 * 4. Use an isolated source actor to compare disabled, enabled and failed-sink
 *    selection while preserving actual current/remote owner observations.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual resolveRuntimeCleanTargets selects an absent or empty runtime tree for removal, then preserves both a legacy unowned run and a malformed owner record with no deletion targets. The isolated actor calls the same planner with disabled tracing, actual enabled observations and a directory obstructing its admitted append path; plans and native errors remain unchanged.
 * @evidence contracts/testing.md#independent-expectations Cleanup may remove a runtime tree with no runs, but cannot infer process death from a missing or unparsable owner record; literal independently authored run paths define the expected protected set. The actor's actual own PID, a distinct hostname and malformed bytes independently select present, remote and invalid observations. Native realpath supplies the invalid-path error independently of the planner.
 * @evidence contracts/testing.md#distinguishing-cases Missing index and empty index select the whole tree; legacy, malformed, actual current and remote owners protect their runs. Disabled, enabled and terminal sink failure preserve the same plan; a native invalid-path error remains an error. No provably dead owner is invented, so abandoned-run removal remains outside this case.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttsx-runtime calls the actual planner over real temporary directories, then one isolated Node source actor owns the private writer's first admission and deliberate sticky sink failure. Its script assertions belong to this named unit. No installation, compiler, Go build or product host starts; an uncertain actor closure retains its inputs.
 */
export function test_runtime_cleanup_preserves_unproven_owners_and_selects_an_absent_tree(): void {
  const cache = TestProject.tmpdir("runtime-clean-plan-");
  const runtime = path.join(cache, "ttsx");
  const runs = path.join(runtime, "project");
  assert.deepEqual(resolveRuntimeCleanTargets(cache), {
    kept: [],
    targets: [runtime],
  });
  fs.mkdirSync(runs, { recursive: true });
  assert.deepEqual(resolveRuntimeCleanTargets(cache), {
    kept: [],
    targets: [runtime],
  });
  const legacy = path.join(fs.realpathSync.native(runs), "legacy");
  fs.mkdirSync(legacy);
  assert.deepEqual(resolveRuntimeCleanTargets(cache), {
    kept: [legacy],
    targets: [],
  });
  const unknown = path.join(fs.realpathSync.native(runs), "unknown");
  fs.mkdirSync(unknown);
  fs.writeFileSync(path.join(unknown, "owner-12.json"), "{", "utf8");
  const plan = resolveRuntimeCleanTargets(cache);
  assert.deepEqual([...plan.kept].sort(), [legacy, unknown].sort());
  assert.deepEqual(plan.targets, []);
  const actorRoot = TestProject.tmpdir("runtime-clean-observation-");
  const actor = TestProject.spawn(process.execPath, [
    "--import", new URL("../../../../../config/register-unit-loader.mjs", import.meta.url).href,
    fileURLToPath(new URL("../../internal/runtime-clean-observation-actor.ts", import.meta.url)), actorRoot,
  ], { env: { NODE_OPTIONS: undefined, TTSC_E2E_TRACE: undefined } });
  if (actor.error || actor.signal !== null || actor.status === null)
    TestProject.retainTemporaryDirectory(actorRoot, "cleanup source actor closure is uncertain");
  assert.equal(actor.error, undefined);
  assert.equal(actor.signal, null);
  assert.equal(actor.status, 0, actor.stdout + "\n" + actor.stderr);
  assert.deepEqual(JSON.parse(actor.stdout), { disabled: true, observed: ["invalid-record", "present", "remote"], sinkFailurePreservedPlan: true, nativeErrorPreserved: true });
}
