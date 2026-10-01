import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies `allowJs` decides whether a new JavaScript file is a membership
 * change.
 *
 * The configuration, not a directory-name list, decides what can enter the
 * program. A project that admits no JavaScript cannot gain a program input when
 * a `.js` file appears, so the appearance is not membership. A project that
 * admits JavaScript can, and refusing to invalidate there would be the
 * correctness half of the same defect in the other direction.
 *
 * 1. Run a pass over a project without `allowJs`, add a `.js` file, and assert the
 *    next pass reuses the generation.
 * 2. Run a pass over a fresh project with `allowJs`.
 * 3. Add a `.js` file and assert the next pass recompiles.
 *
 * @evidence contracts/testing.md#behavioral-verification Identical emitted.js creation leaves the strict session at one capture but moves the allowJs session from one to two after its next pass. This detects both needless JavaScript output invalidation and missing admitted-source invalidation.
 * @evidence contracts/testing.md#independent-expectations The allowJs language option independently decides whether the same JavaScript path can enter the Program. Literal one/one and one/two counts come from sidecar log bytes, not membership digest computation; the sidecar does not transform this JavaScript output itself.
 * @evidence contracts/testing.md#distinguishing-cases The only policy distinction is allowJs false versus true on fresh otherwise matching projects. Each starts with a real baseline and then sees the same source extension appear; TypeScript membership cases are complementary.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_allowjs_decides_javascript_membership in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution Two startMembershipSession consumers share the counting-sidecar source and native build cache. Separate options/root/cache populations are necessary so the allowJs policy cannot inherit the strict baseline; within each session both passes share the same producer and generation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both consumers have unique roots/logs and independent caches. Each close executes in its own finally before the next session, releasing trackers regardless of failure; TestProject owns temporary directories through runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_allowjs_decides_javascript_membership; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_allowjs_decides_javascript_membership(): Promise<void> {
  const strict = await startMembershipSession();
  try {
    await strict.pass();
    assert.equal(strict.compiles(), 1);
    fs.writeFileSync(
      path.join(strict.root, "src", "emitted.js"),
      "module.exports = 1;\n",
      "utf8",
    );
    await strict.pass();
    assert.equal(
      strict.compiles(),
      1,
      "a project that admits no JavaScript must not treat a .js file as membership",
    );
  } finally {
    strict.close();
  }

  const widened = await startMembershipSession({ allowJs: true });
  try {
    await widened.pass();
    assert.equal(widened.compiles(), 1);
    fs.writeFileSync(
      path.join(widened.root, "src", "emitted.js"),
      "module.exports = 1;\n",
      "utf8",
    );
    await widened.pass();
    assert.equal(
      widened.compiles(),
      2,
      "a project that admits JavaScript must treat a new .js file as membership",
    );
  } finally {
    widened.close();
  }
}
