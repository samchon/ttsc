/**
 * Internal controls for Go object-cache maintenance.
 *
 * Sizes are bytes and ages are milliseconds. Omitted controls use the owned
 * Go-cache retention policy; the clock can be supplied by the invoking owner.
 *
 * @evidence contracts/common.md#principled-implementation Trigger and target sizes are separate from recent-file protection and the current clock, preserving the collector's independent decisions.
 * @evidence contracts/common.md#clear-and-simple-design A small option object reuses one collector for explicit and default maintenance.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied limits and time are ordinary inputs; production does not detect tests or fabricate object sizes to meet an expected result.
 * @evidence contracts/common.md#meaningful-documentation Owning prose states byte/millisecond units and defaults; members describe the ceiling, target and protection window separately.
 */
export interface IGoBuildCachePruneOptions {
  /** Ignore the once-daily marker. */
  force?: boolean;

  /** Size that triggers LRU pruning. */
  maxBytes?: number;

  /** Size to prune toward once the ceiling is crossed. */
  targetBytes?: number;

  /** Current wall-clock time in milliseconds since the Unix epoch. */
  now?: number;

  /** Recent-file protection window. */
  protectedAgeMs?: number;
}
