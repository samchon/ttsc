/**
 * Default retention thresholds for plugin binaries (`prunePluginCacheRoot`) and
 * single-file descriptor, capability and orphan-lowering answers
 * (`pruneCacheFileRoot`).
 *
 * The caches are content-keyed, so a project that bumps tsgo or a plugin many
 * times leaves one stale entry per superseded key. Eligible collections are
 * normally spaced one day per part, attempt eviction after 30 unused days and,
 * past a 2 GiB threshold, prune oldest entries toward 80% of it. Protected
 * entries, live or uncertain owners and failed deletions can defer eviction
 * without a finite size or age bound. An over-budget marker makes a retry
 * eligible after the protection window; collection still depends on a later
 * invocation. Collectors stay within their selected cache part rather than
 * discovering global cache locations. The Go object cache has its own policy in
 * `pruneGoBuildCacheRoot`.
 *
 * @evidence contracts/common.md#principled-implementation Age, size and protection thresholds describe reclaimable cache storage, not the semantic validity of an answer.
 * @evidence contracts/common.md#clear-and-simple-design One policy namespace keeps binary and single-file collectors on the same units and defaults.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The durations, byte budgets and marker spelling are product retention policy, not consumer-specific answers.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes thresholds from hard bounds and explains retry behavior; documented constants are separated by blank lines under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This namespace defines eligibility thresholds and retry pacing but owns no cache storage or eviction task; the collectors own protection, failed deletion and historical coordination-state lifetimes, with no guaranteed size or age bound.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace holds constants and implements no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace holds constants only, so it has no computation to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Defines durations, byte budgets and a marker file name only; no path is built or resolved in this namespace.
 */
export namespace CachePrunePolicy {
  /**
   * Normal interval between successful collections; over-budget retries can be
   * earlier.
   */
  export const GC_INTERVAL_MS = 24 * 60 * 60 * 1000;

  /** Unused age after which an entry is eligible for collection. */
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
