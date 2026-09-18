/**
 * What the watch launcher does in response to one directory event over the
 * compiler's inputs, as planned by {@link planCompilerDirectoryWatchEvent}.
 */
export type CompilerDirectoryWatchEventPlan = {
  /** Tracked input files to report as changed to the next build cycle. */
  changes: string[];

  /**
   * Tracked files whose per-file watcher must be recreated, because a rename
   * replaced the inode the old watcher was observing. Always empty on Windows,
   * where inputs are observed through their directories only.
   */
  rearm: string[];

  /**
   * Recompute the watch topology, because the event may have added or removed
   * an input (an unnamed event, or a name that is not a tracked file).
   */
  refresh: boolean;
};
