import { assertCacheInvalidatesThroughLinkedGraphEdge } from "../../internal/transform-external";

/**
 * Verifies a graph input reached through a filesystem link invalidates cache.
 *
 * The project walk deliberately does not follow symbolic links or Windows
 * junctions. Classifying the linked spelling as walk-covered would therefore
 * omit it from both the project and external snapshots and replay stale
 * output.
 *
 * 1. Link an in-project directory to an external declaration and emit a graph edge
 *    through the linked spelling.
 * 2. Transform once and edit only the link target.
 * 3. Transform again and assert a new project generation replaced the cache.
 */
export const test_transformttsc_invalidates_project_cache_through_a_linked_graph_edge =
  async () => {
    await assertCacheInvalidatesThroughLinkedGraphEdge();
  };
