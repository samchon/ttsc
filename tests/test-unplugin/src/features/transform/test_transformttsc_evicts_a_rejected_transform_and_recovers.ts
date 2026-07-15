import { assertRejectedTransformIsEvictedAndRecovers } from "../../internal/transform-project-cache";

/**
 * Verifies a rejected transform generation is evicted so adapters recover
 * (#672).
 *
 * The per-build cache stores the in-flight transform Promise before it settles
 * so concurrent callers share one compile. A rejected generation used to stay
 * cached, making a transient toolchain/host failure permanent for a long-lived
 * Metro or Turbopack worker: the unchanged module replayed the old rejection
 * forever. A failed generation must instead be surfaced and removed.
 *
 * 1. Prime a shared cache with one successful transform of the fixture.
 * 2. Replace that entry with a rejected Promise and retry the same module.
 * 3. Assert the retry rejects and the failed entry is evicted, then a further
 *    retry re-runs the transform and succeeds.
 */
export const test_transformttsc_evicts_a_rejected_transform_and_recovers =
  async () => {
    await assertRejectedTransformIsEvictedAndRecovers();
  };
