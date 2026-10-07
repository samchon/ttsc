import { assertCleanTransformClearsVolatileSnapshot } from "../../internal/metro-cache";

/**
 * Verifies a clean Metro worker clears a prior volatile snapshot declaration.
 *
 * A volatile transform must make cache keys non-reusable, but removing that
 * declaration must restore reuse after one subsequent clean transform. The
 * clean transform's inputs are all inside the project walk, which is the
 * ordinary shape that previously failed to materialize a clearing worker
 * observation.
 *
 * 1. Record one worker's volatile declaration, then compact its snapshot.
 * 2. Record another worker's all-in-walk transform, then compact again.
 * 3. Assert the volatile bit clears and two fresh cache keys are equal.
 *
 * @evidence contracts/testing.md#behavioral-verification A recorder's recordVolatile followed by prepareSnapshot sets the main snapshot's volatile to true; a second recorder then records src/app.ts and after another prepareSnapshot volatile is false and two getCacheKey calls are equal.
 * @evidence contracts/testing.md#independent-expectations The expected true-then-false volatile values and the restored key equality are authored from the contract that only the latest worker observations decide volatility, not computed from the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Volatile-to-clean is the single transition covered. Key nonreuse while volatile is not asserted in this body (only the persisted volatile flag is checked after the first compaction).
 * @evidence contracts/testing.md#execution-ownership Unit layer: drives createSnapshotRecorder, prepareSnapshot and getCacheKey in-process, modelling two workers at the recorder boundary; no native compile, consumer install or Metro host.
 */
export const test_clean_transform_clears_a_volatile_snapshot = async () => {
  await assertCleanTransformClearsVolatileSnapshot();
};
