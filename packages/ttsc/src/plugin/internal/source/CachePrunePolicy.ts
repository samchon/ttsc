/**
 * The retention policy every collected part of ttsc's cache root follows: the
 * plugin binaries (`prunePluginCacheRoot`) and the single-file answers of the
 * descriptor, capability, and orphan-lowering caches (`pruneCacheFileRoot`).
 *
 * The caches are content-keyed, so a project that bumps tsgo or a plugin many
 * times leaves one stale entry per superseded key. A collection runs at most
 * once a day per part, evicts entries unused for 30 days and, past a 2 GiB
 * ceiling, the least recently used down to 80% of it. It is scoped to the
 * resolved cache root only: ttsc never scans a shared or global location.
 */
export namespace CachePrunePolicy {
  /** How often one part of the root is collected. */
  export const GC_INTERVAL_MS = 24 * 60 * 60 * 1000;

  /** How long an entry may go unused before it is evicted. */
  export const ENTRY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  /** Size of one part that triggers least-recently-used eviction. */
  export const MAX_BYTES = 2 * 1024 * 1024 * 1024;

  /** Size least-recently-used eviction prunes toward. */
  export const TARGET_BYTES = Math.floor(MAX_BYTES * 0.8);

  /** How recently an entry must have been used to survive the ceiling. */
  export const PROTECTED_AGE_MS = 60 * 60 * 1000;

  /** Name of the file recording when a part was last collected. */
  export const GC_MARKER_FILE = ".gc-last-run";
}
