import { assertTransformCacheInvalidatesOnLibSourceChange } from "../../internal/transform-compiler-options";

/**
 * Verifies transformTtsc invalidates the project cache when a lib source file
 * listed in the plugin config changes.
 *
 * Plugins can declare arbitrary file dependencies via a `path` config option.
 * If the cache only tracked project source files but not plugin-declared
 * dependencies, a change to `lib/helper.ts` would not invalidate the cached
 * transform result, and consumers would see stale output. This pins that a
 * plugin-configured dependency path is tracked and that its mutation triggers
 * cache invalidation.
 *
 * 1. Create a fixture with a plugin that uses `operation:
 *    "read-configured-helper"` pointing to `lib/helper.ts`.
 * 2. Write `lib/helper.ts` with content "first" and run `transformTtsc` — assert
 *    output contains `"PLUGIN:FIRST"`.
 * 3. Overwrite `lib/helper.ts` with "second" and run `transformTtsc` again —
 *    assert output now contains `"PLUGIN:SECOND"`.
 */
export const test_transformttsc_invalidates_project_cache_when_lib_source_changes =
  async () => {
    await assertTransformCacheInvalidatesOnLibSourceChange();
  };
