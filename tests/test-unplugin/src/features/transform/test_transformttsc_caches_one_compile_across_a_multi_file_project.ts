import { assertCacheTransformsMultiFileProjectOnce } from "../../internal/transform-project-cache";

/**
 * Verifies the shared project cache compiles a multi-file project once.
 *
 * The adapter compiles the whole tsconfig project once and serves every other
 * module from one shared cache. This is the happy-path baseline: every compiler
 * output key sits inside the project walk, so the cache hits on both the old
 * and fixed code. The out-of-walk regression (#252) is pinned by the sibling
 * test; this one guards that the ordinary multi-file path keeps working.
 *
 * 1. Create a six-file project with a counting fixture transform.
 * 2. Run `transformTtsc` over every module sharing one cache.
 * 3. Assert the plugin ran once and every module came back transformed.
 */
export const test_transformttsc_caches_one_compile_across_a_multi_file_project =
  async () => {
    await assertCacheTransformsMultiFileProjectOnce();
  };
