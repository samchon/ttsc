/**
 * Internal controls for Go object-cache maintenance.
 *
 * Sizes are bytes and ages are milliseconds. Omitted controls use the owned
 * Go-cache retention policy; the clock can be supplied by the invoking owner.
 * Recent age selects a target-sized cohort with the collector's mtime allowance,
 * rather than protecting every recent file. This type imposes no finite-number,
 * range or ordering validation.
 *
 * @evidence contracts/common.md#principled-implementation Trigger and target sizes are separate from recent-file protection and the current clock, preserving the collector's independent decisions.
 * @evidence contracts/common.md#clear-and-simple-design One option record supplies overrides to the existing selected-root collector; omitted fields retain its defaults rather than selecting a different maintenance implementation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied limits and time are ordinary inputs; production does not detect tests or fabricate object sizes to meet an expected result.
 * @evidence contracts/common.md#meaningful-documentation Owning prose states byte/millisecond units, defaults, cohort scope and numeric-validation limits; members distinguish interval bypass from build-lease safety and recent-age eligibility from a retention guarantee.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export interface IGoBuildCachePruneOptions {
  /** Ignore the interval marker; build-lease exclusion still applies. */
  force?: boolean;

  /** Size that triggers LRU pruning. */
  maxBytes?: number;

  /** Size to prune toward once the ceiling is crossed. */
  targetBytes?: number;

  /** Current wall-clock time in milliseconds since the Unix epoch. */
  now?: number;

  /** Recent-age threshold for cohort selection, with the mtime allowance added. */
  protectedAgeMs?: number;
}
