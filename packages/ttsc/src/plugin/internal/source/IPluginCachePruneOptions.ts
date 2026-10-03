/**
 * Internal controls for plugin-binary cache maintenance; the single-file
 * collector uses the same numeric controls without `protectedEntries`.
 *
 * Sizes are bytes and ages are milliseconds. Omitted controls use the shared
 * retention policy. Explicit protected entries are caller-selected cache
 * directories; the cold-build caller supplies its just-returned entry, but the
 * collector validates location rather than proving how an entry was produced.
 * This type imposes no finite-number, range or ordering validation.
 *
 * @evidence contracts/common.md#principled-implementation Independent trigger, target, clock and protection fields represent the eviction decisions without confusing byte limits with millisecond age thresholds.
 * @evidence contracts/common.md#clear-and-simple-design One internal option object configures the existing collector instead of a separate deterministic maintenance implementation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Overrides are explicit maintenance inputs shared with production; no branch changes behavior by recognizing a test or expected eviction result.
 * @evidence contracts/common.md#meaningful-documentation Owning prose supplies units, omission behavior and numeric-validation limits; members distinguish forced passes, recent-cohort selection and caller-selected protected entries.
 * @evidence contracts/portability.md#os-neutral-implementation Protected entries are native cache directories validated against the canonical root; numeric byte and millisecond controls do not encode an OS's case or path rules.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface IPluginCachePruneOptions {
  /** Ignore the once-daily marker. */
  force?: boolean;

  /** Size that triggers LRU pruning. */
  maxBytes?: number;

  /** Current wall-clock time in milliseconds since the Unix epoch. */
  now?: number;

  /** Recent-use age for the binary cohort or single-file size protection. */
  protectedAgeMs?: number;

  /** Cache directories explicitly protected by this invocation's caller. */
  protectedEntries?: readonly string[];

  /** Size to prune toward once the ceiling is crossed. */
  targetBytes?: number;
}
