import { assertHostExceptionTransformIsEvictedAndRecovers } from "../../internal/transform-project-cache";

/**
 * Verifies a resolved host-exception transform is evicted so adapters recover
 * (#672).
 *
 * A generation can fail not only by rejecting but by resolving to an
 * `ITtscCompilerTransformation` whose `type` is `"exception"`, which makes
 * `selectTransformedSource` throw. That failed generation used to remain cached
 * and replay the exception for the worker's lifetime. It must be surfaced and
 * removed like a rejected one.
 *
 * 1. Prime a shared cache with one successful transform of the fixture.
 * 2. Replace that entry with a resolved `"exception"` envelope (reusing the
 *    primed project hashes so the cached entry validates) and retry the module.
 * 3. Assert the retry throws and the entry is evicted, then a further retry
 *    re-runs the transform and succeeds.
 */
export const test_transformttsc_evicts_a_host_exception_transform_and_recovers =
  async () => {
    await assertHostExceptionTransformIsEvictedAndRecovers();
  };
