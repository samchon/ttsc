import { assertCacheInvalidatesThroughExternalGraphEdge } from "../../internal/transform-external";

/**
 * Verifies cache invalidation flows through a reference-graph edge to an
 * out-of-walk file the plugin never reads.
 *
 * Type-only inputs (`node_modules` declarations, monorepo sibling sources)
 * reach the transform through the host-owned graph, not through plugin file
 * reads, so the external validation must consume the graph channel — not just
 * the reported dependencies list.
 *
 * 1. Transform with a graph edge from `src/main.ts` to a file outside the project
 *    root; capture the cached generation object.
 * 2. Edit only that external file.
 * 3. Transform again with the same cache; assert a new generation replaced the
 *    cached one.
 */
export const test_transformttsc_invalidates_project_cache_through_an_external_graph_edge =
  async () => {
    await assertCacheInvalidatesThroughExternalGraphEdge();
  };
