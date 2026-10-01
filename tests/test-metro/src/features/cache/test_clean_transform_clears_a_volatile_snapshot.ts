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
 * @evidence contracts/testing.md#behavioral-verification A source recorder marks a snapshot volatile, then a clean all-in-walk observation clears volatility and restores equal fresh keys.
 * @evidence contracts/testing.md#independent-expectations Only current worker observations determine the next volatility verdict; authored true-to-false state and restored equality establish recovery independently.
 * @evidence contracts/testing.md#distinguishing-cases Volatile-to-clean transition contrasts persistent volatile nonreuse without invoking a compiler to simulate recorder semantics.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_clean_transform_clears_a_volatile_snapshot = async () => {
  await assertCleanTransformClearsVolatileSnapshot();
};
