import { assertWebpackFilesystemCacheServesStaleWithoutGraph } from "../../internal/adapter-webpack";

/**
 * Verifies the reproduction baseline: without a graph-emitting producer,
 * webpack's kept filesystem cache serves the stale consumer module after the
 * type file changes.
 *
 * This control pins that the positive scenario
 * (test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge) is real
 * evidence: it proves the cache actually replays stale output when the edge is
 * unregistered, so a pass on the positive test demonstrates the graph channel
 * and not some unrelated invalidation. If webpack's caching model ever changes
 * and this control turns fresh, both scenarios need a new witness.
 *
 * 1. Build the reproduction project without the graph-emitting plugin entry.
 * 2. Edit the type file and rebuild with the cache kept.
 * 3. Assert the second bundle still embeds only the old interface.
 */
export const test_webpack_filesystem_cache_control_serves_stale_without_a_graph =
  async () => {
    await assertWebpackFilesystemCacheServesStaleWithoutGraph();
  };
