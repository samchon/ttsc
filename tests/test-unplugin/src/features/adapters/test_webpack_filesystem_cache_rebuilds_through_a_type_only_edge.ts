import { assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge } from "../../internal/adapter-webpack";

/**
 * Verifies webpack's kept filesystem cache rebuilds a consumer module when a
 * file reachable only through a type-only graph edge changes.
 *
 * Acceptance scenario of samchon/ttsc#716 (field report samchon/typia#2092):
 * webpack erases `import type` edges, so a module whose generated output embeds
 * a consulted type is restored from the persistent cache after the type file
 * changes — stale generated code, previously worked around by deleting the
 * cache before every build. With the producer emitting the reference graph, the
 * adapter registers the edge in `fileDependencies` and the cache invalidates
 * soundly without any deletion.
 *
 * 1. Build the reproduction project (type-only import; plugin output embeds the
 *    type file's content; producer emits the graph edge) with `cache: { type:
 *    "filesystem" }`.
 * 2. Edit the type file and rebuild with the cache kept.
 * 3. Assert the second bundle embeds the new interface member.
 */
export const test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge =
  async () => {
    await assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge();
  };
