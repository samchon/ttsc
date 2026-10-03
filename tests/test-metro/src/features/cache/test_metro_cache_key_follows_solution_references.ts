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
 * @evidence contracts/testing.md#behavioral-verification With a root tsconfig of files [] referencing tsconfig.app.json, repeated getCacheKey calls match, then editing src/app.ts changes it, then editing tsconfig.app.json (strict true to false) changes it again.
 * @evidence contracts/testing.md#independent-expectations The referenced-project routing contract (the worker compiles through the referenced config) is expressed as literal equality then two inequalities over authored edits, not recomputed from the fingerprint.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged solution (equal), a referenced source edit and a referenced config edit are three distinct decisions run on a solution whose own files list is empty.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey from fresh transformer modules in-process over a temp solution layout; no native compile, consumer install or Metro host.
 */
export const test_metro_cache_key_follows_solution_references = async () => {
  await assertCacheKeyFollowsSolutionReferences();
};
