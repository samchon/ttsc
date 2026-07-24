/** Normalized local filesystem dependencies published by project rules. */
export interface ITtscProjectInputSnapshot {
  /** Exact absolute paths, retained even while missing. */
  files: readonly string[];
  /** Absolute glob patterns using forward-slash separators. */
  globs: readonly string[];
  /** Physical project root that anchored relative declarations. */
  root: string;
}
