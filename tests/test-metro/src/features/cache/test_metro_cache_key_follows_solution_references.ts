import { assertCacheKeyFollowsSolutionReferences } from "../../internal/metro-cache";

/**
 * Verifies a solution layout keys Metro's cache through its referenced
 * projects.
 *
 * See {@link assertCacheKeyFollowsSolutionReferences}: the worker compiles each
 * module with the project the solution config references, so that project's
 * sources and config must move the key (samchon/ttsc#1397).
 */
export const test_metro_cache_key_follows_solution_references = async () => {
  await assertCacheKeyFollowsSolutionReferences();
};
