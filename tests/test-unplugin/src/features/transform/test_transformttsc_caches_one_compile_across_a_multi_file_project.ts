import { assertCacheTransformsMultiFileProjectOnce } from "../../internal/transform-project-cache";

/**
 * Verifies the per-build cache collapses a multi-file project into one compile.
 *
 * The adapter compiles the whole tsconfig project once and serves every other
 * module from the per-build cache. A regression in the cache's hash bookkeeping
 * would re-transform the whole project per module; this pins that driving every
 * module through one shared cache spawns the native transform exactly once.
 *
 * 1. Create a six-file project with a counting fixture transform.
 * 2. Run `transformTtsc` over every module sharing one cache.
 * 3. Assert the plugin ran once and every module came back transformed.
 */
export const test_transformttsc_caches_one_compile_across_a_multi_file_project =
  async () => {
    await assertCacheTransformsMultiFileProjectOnce();
  };
