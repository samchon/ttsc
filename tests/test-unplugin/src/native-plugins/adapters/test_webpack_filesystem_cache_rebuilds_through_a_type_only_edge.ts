import { assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge } from "../../internal/adapter-webpack/assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge";

/**
 * Verifies the fixed behavior: with a producer emitting the reference graph,
 * editing the type file invalidates the consumer module in webpack's kept
 * filesystem cache, so the second build embeds the new interface without any
 * cache deletion.
 */
export async function test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge(): Promise<void> {
  await assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge();
}
