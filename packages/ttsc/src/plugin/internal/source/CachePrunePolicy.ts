/**
 * The retention policy every collected part of ttsc's cache root follows: the
 * plugin binaries (`prunePluginCacheRoot`) and the single-file answers of the
 * descriptor, capability, and orphan-lowering caches (`pruneCacheFileRoot`).
 *
 * The caches are content-keyed, so a project that bumps tsgo or a plugin many
 * times leaves one stale entry per superseded key. A collection normally runs
 * once a day per part, evicts entries unused for 30 days and, past a 2 GiB
 * threshold, removes least-recently-used entries toward 80% of it. Protected
 * entries and failed deletions can keep usage above the target; a retry is then
 * eligible after the protection window. It is scoped to the resolved cache root
 * only: ttsc never scans a shared or global location.
 *
 * @evidence contracts/common.md#principled-implementation Age, size and protection thresholds describe reclaimable cache storage, not the semantic validity of an answer.
 * @evidence contracts/common.md#clear-and-simple-design One policy namespace keeps binary and single-file collectors on the same units and defaults.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The durations, byte budgets and marker spelling are product retention policy, not consumer-specific answers.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes thresholds from hard bounds and explains retry behavior; documented constants are separated by blank lines under the documentation guidance.
 */
export namespace CachePrunePolicy {
  /**
   * Normal interval between successful collections; over-budget retries can be
   * earlier.
   */
  export const GC_INTERVAL_MS = 24 * 60 * 60 * 1000;

  /** How long an entry may go unused before it is evicted. */
  export const ENTRY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  /** Size of one part that triggers least-recently-used eviction. */
  export const MAX_BYTES = 2 * 1024 * 1024 * 1024;

  /** Size least-recently-used eviction prunes toward. */
  export const TARGET_BYTES = Math.floor(MAX_BYTES * 0.8);

  /** Recent-use window considered by each collector's protection policy. */
  export const PROTECTED_AGE_MS = 60 * 60 * 1000;

  /** Name of the file recording when a part was last collected. */
  export const GC_MARKER_FILE = ".gc-last-run";
}
