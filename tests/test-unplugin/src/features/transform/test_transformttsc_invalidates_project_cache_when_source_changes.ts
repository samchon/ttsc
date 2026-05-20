import { assertTransformCacheInvalidatesOnSourceChange } from "../../internal/transform-compiler-options";

/**
 * Verifies transformTtsc invalidates the project cache when the transformed
 * source file itself changes.
 *
 * The transform cache stores results keyed on source content. If the cache
 * entry were not invalidated on source mutation, the second call would return
 * the stale result and consumers would never see updated output. This pins that
 * modifying the file being transformed produces a fresh result on the next
 * `transformTtsc` call.
 *
 * 1. Create a fixture project and run `transformTtsc` — assert output contains the
 *    first plugin marker.
 * 2. Overwrite the main source file with different content.
 * 3. Run `transformTtsc` again with the new source — assert the output now
 *    reflects the new content.
 */
export const test_transformttsc_invalidates_project_cache_when_source_changes =
  async () => {
    await assertTransformCacheInvalidatesOnSourceChange();
  };
