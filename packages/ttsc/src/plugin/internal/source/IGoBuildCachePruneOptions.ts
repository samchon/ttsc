/** Test/internal controls for deterministic Go object-cache maintenance. */
export interface IGoBuildCachePruneOptions {
  /** Ignore the once-daily marker. */
  force?: boolean;
  /** Size that triggers LRU pruning. */
  maxBytes?: number;
  /** Size to prune toward once the ceiling is crossed. */
  targetBytes?: number;
  /** Injected clock for deterministic tests. */
  now?: number;
  /** Recent-file protection window. */
  protectedAgeMs?: number;
}
