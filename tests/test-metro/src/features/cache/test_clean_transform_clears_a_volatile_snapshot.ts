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
 */
export const test_clean_transform_clears_a_volatile_snapshot = async () => {
  await assertCleanTransformClearsVolatileSnapshot();
};
