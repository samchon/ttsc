/** Test/internal controls for deterministic plugin-binary cache maintenance. */
export interface IPluginCachePruneOptions {
  /** Ignore the once-daily marker. */
  force?: boolean;
  /** Size that triggers LRU pruning. */
  maxBytes?: number;
  /** Injected clock for deterministic tests. */
  now?: number;
  /** Recent-entry protection window. */
  protectedAgeMs?: number;
  /** Entries whose binary was returned by the current cold build. */
  protectedEntries?: readonly string[];
  /** Size to prune toward once the ceiling is crossed. */
  targetBytes?: number;
}
