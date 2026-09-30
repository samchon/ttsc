import { assertCacheKeyFollowsSolutionReferences } from "../../internal/metro-cache";

/**
 * Verifies a solution layout keys Metro's cache through its referenced
 * projects.
 *
 * See {@link assertCacheKeyFollowsSolutionReferences}: the worker compiles each
 * module with the project the solution config references, so that project's
 * sources and config must move the key (samchon/ttsc#1397).
 *
 * 1. Prepare an empty-root solution referencing an application config.
 * 2. Verify unchanged reuse, then edit a referenced source.
 * 3. Edit the referenced config and verify each change invalidates the key.
 *
 * @evidence contracts/testing.md#behavioral-verification An unchanged solution keeps its key, then a referenced source edit and referenced tsconfig edit each change it.
 * @evidence contracts/testing.md#independent-expectations Solution references route compilation to the referenced project, so its inputs independently own invalidation even though the solution has files: [].
 * @evidence contracts/testing.md#distinguishing-cases Empty solution roots contrast populated reference roots, unchanged state and two distinct referenced input edits.
 * @evidence contracts/testing.md#execution-ownership This named src/unit/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_metro_cache_key_follows_solution_references = async () => {
  await assertCacheKeyFollowsSolutionReferences();
};
