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
 */
export const test_cache_key_changes_when_a_project_source_file_changes =
  async () => {
    await assertCacheKeyChangesWhenProjectSourceChanges();
  };
