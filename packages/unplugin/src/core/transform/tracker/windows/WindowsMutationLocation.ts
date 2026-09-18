/**
 * One directory the Windows broker watches for a tracker.
 *
 * A location either watches the named entries of one directory (`names`) or,
 * with `recursive`, the whole tree below it. The name form is how exact-input
 * trackers keep their event traffic proportional to the inputs they own.
 */
export interface WindowsMutationLocation {
  /** Directory the broker watches, in the walk's own spelling. */
  directory: string;
  /**
   * Entry names to report, case-folded by the broker; omitted for a recursive
   * location.
   */
  names?: string[];
  /**
   * Whether to watch the whole tree below the directory instead of named
   * entries.
   */
  recursive?: boolean;
}
