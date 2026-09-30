import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies a new source file is detected wherever it lands, including a
 * directory the old ignore list named.
 *
 * This is the correctness half of samchon/ttsc#1307. The ignore list matched a
 * bare entry name at every depth, so `src/build/` was dropped from the walk and
 * a program input created there was never seen: the adapter kept serving output
 * from a compile that had never read the file. The control and the subject are
 * the same file under two directory names, and before the fix they answered
 * differently.
 *
 * 1. Run passes until the generation settles.
 * 2. Add a source under `src/feature/` and assert the next pass recompiles.
 * 3. Add a source under `src/build/` and assert the next pass recompiles, then
 *    settles again.
 *
 * @evidence contracts/testing.md#behavioral-verification Membership-session passes require counts 1,1,2,3,3 when sources appear first under src/feature then src/build. This exposes depth-insensitive ignore rules while retaining unchanged-generation controls.
 * @evidence contracts/testing.md#independent-expectations Both fixture files are admitted TypeScript inputs beneath src, regardless of the nested directory name. Independent sidecar bytes and literal counts require equivalent invalidation and later reuse rather than calculating the walk result as the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary nested source creation is the control for the formerly ignored build name; initial and final unchanged passes test settled reuse. Top-level output creation is covered separately.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_new_source_is_detected_in_any_directory in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution startMembershipSession uses one fresh createCacheProject and its shared counting-sidecar source/build cache. Its passes deliver the same three modules through one transform cache; only the two admitted membership changes require new invocations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The session isolates project and log roots, holds compiler options fixed, and mutates only its src subtree. finally session.close resets the cache and trackers; temporary directories belong to TestProject through runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_new_source_is_detected_in_any_directory; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_new_source_is_detected_in_any_directory(): Promise<void> {
  const session = await startMembershipSession();
  try {
    await session.pass();
    assert.equal(session.compiles(), 1);
    await session.pass();
    assert.equal(session.compiles(), 1, "an unchanged project costs nothing");

    const control = path.join(session.root, "src", "feature", "a.ts");
    fs.mkdirSync(path.dirname(control), { recursive: true });
    fs.writeFileSync(control, "export const a: number = 1;\n", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      2,
      "a new source in an ordinary directory must replace the generation",
    );

    // The same file, under a name the old list refused to walk.
    const subject = path.join(session.root, "src", "build", "b.ts");
    fs.mkdirSync(path.dirname(subject), { recursive: true });
    fs.writeFileSync(subject, "export const b: number = 2;\n", "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "a new source must be detected even where the old ignore list matched",
    );

    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "and the generation settles again once nothing moves",
    );
  } finally {
    session.close();
  }
}
