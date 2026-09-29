/**
 * What the watch launcher does in response to one directory event over the
 * compiler's inputs, as planned by {@link planCompilerDirectoryWatchEvent}.
 *
 * @evidence contracts/common.md#principled-implementation Changes, inode rearming and population refresh are separate decisions rather than treating every backend event as a content edit.
 * @evidence contracts/common.md#clear-and-simple-design Three fields carry the planner's independent actions to the topology owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The plan represents actual supported watcher actions without consumer or fixture identities.
 * @evidence contracts/common.md#meaningful-documentation Member paragraphs explain tracked changes, Windows rearm absence and unnamed-event refresh following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The rearm field exposes the native backend distinction explicitly; the type performs no guessed filesystem case conversion.
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
