import { assertCacheKeyChangesWhenProjectSourceChanges } from "../../internal/metro-cache";

/**
 * Verifies editing any project source between runs changes the cache key.
 *
 * Metro keys each file only on its own content, so an edit to file B never
 * re-keys a dependent file A; the project-walk half of the fingerprint
 * (samchon/ttsc#721) is what re-keys the whole run instead.
 *
 * 1. Create a plugin-less project, prepare the snapshot, compute the key.
 * 2. Edit one source file; compute the key in a fresh transformer module.
 * 3. Assert the keys differ.
 *
 * @evidence contracts/testing.md#behavioral-verification Changing src/app.ts from number=1 to union=2 changes getCacheKey without changing transformer options.
 * @evidence contracts/testing.md#independent-expectations A program source can affect dependent output, so its content must invalidate the project key independently of the hash algorithm.
 * @evidence contracts/testing.md#distinguishing-cases A single in-project content edit contrasts the unchanged-project control.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_changes_when_a_project_source_file_changes =
  async () => {
    await assertCacheKeyChangesWhenProjectSourceChanges();
  };
