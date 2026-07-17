import { assertWebpackFilesystemCacheServesStaleForUnderDeclaredComplete } from "../../internal/adapter-webpack";

/**
 * Verifies the defect surface of the completeness contract: a plugin that
 * declares an under-declared list complete makes webpack's kept filesystem
 * cache serve stale generated code.
 *
 * The completeness contract (samchon/ttsc#720) transfers responsibility to the
 * declaring plugin, and this pins what that costs when the plugin is wrong. The
 * project is the same one
 * `test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge` rebuilds
 * soundly, and the producer still emits the graph edge; only the declaration
 * differs. That isolates the cause: the host honors the claim and drops the
 * edge rather than auditing it, since verifying a complete list would cost the
 * exact reachability walk the declaration exists to avoid. If this ever turns
 * fresh, the host started auditing and the narrowing stopped being real.
 *
 * 1. Build a project whose plugin reads `src/mytype.ts`, emits the graph edge to
 *    it, reports no dependencies, and declares `src/main.ts` complete.
 * 2. Edit the type file and rebuild with the filesystem cache kept.
 * 3. Assert the second bundle still embeds the old interface.
 */
export const test_webpack_filesystem_cache_serves_stale_for_an_under_declared_complete_file =
  async () => {
    await assertWebpackFilesystemCacheServesStaleForUnderDeclaredComplete();
  };
