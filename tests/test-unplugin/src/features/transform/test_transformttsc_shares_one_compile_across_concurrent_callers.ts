import { assertConcurrentTransformsCompileOnce } from "../../internal/transform-project-cache";

/**
 * Verifies concurrent transforms of one module still compile the project once
 * (#672).
 *
 * The failed-generation eviction fix must preserve single-flight: two callers
 * racing for the same cache key share the one in-flight generation rather than
 * each spawning a compile. This is the preservation twin of the eviction
 * scenarios.
 *
 * 1. Build the run-log fixture that counts whole-project compiles.
 * 2. Fire two `transformTtsc` calls for the same module concurrently, sharing
 *    one cache.
 * 3. Assert both return transformed output and the fixture compiled exactly
 *    once.
 */
export const test_transformttsc_shares_one_compile_across_concurrent_callers =
  async () => {
    await assertConcurrentTransformsCompileOnce();
  };
