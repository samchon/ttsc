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
 * @evidence contracts/testing.md#behavioral-verification Rewriting src/app.ts from `number = 1` to `1 | 2 = 2` between two getCacheKey calls, each in a freshly loaded transformer module with identical options and a fake upstream, produces two different keys.
 * @evidence contracts/testing.md#independent-expectations The expectation is a literal inequality for an authored content edit to a file inside the include root; it does not recompute the digest. Oracle limit: the assertion cannot tell which hashed input (content, identity) moved the key.
 * @evidence contracts/testing.md#distinguishing-cases One positive case: a content-only edit of the single project source. The unchanged-project equality control is not in this body; it is owned by test_cache_key_is_stable_across_runs_for_an_unchanged_project.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls fingerprint.prepareSnapshot and the transformer module's getCacheKey (fake CommonJS upstream) in-process over a temp project from createBareProject; no native compiler, consumer install or Metro process is started.
 */
export const test_cache_key_changes_when_a_project_source_file_changes =
  async () => {
    await assertCacheKeyChangesWhenProjectSourceChanges();
  };
