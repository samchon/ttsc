import { assertFilesystemOperationsAreCacheLocal } from "../../internal/transform-project-cache";

/**
 * Verifies transform caches own independent filesystem operation contexts.
 *
 * A process-global current-operation slot can look isolated under sequential
 * calls but routes one suspended transform through another cache's counters or
 * injected failures. Concurrent projects must retain their own context across
 * every async generation boundary.
 *
 * 1. Start transforms for two distinct projects and caches concurrently.
 * 2. Inject post-compile readdir failures only through the first cache.
 * 3. Assert the faulty cache terminates after two attempts, the healthy cache
 *    succeeds, both counters run, and the first operation never observes the
 *    second project's paths.
 */
export async function test_transformttsc_filesystem_operations_are_cache_local(): Promise<void> {
  await assertFilesystemOperationsAreCacheLocal();
}
