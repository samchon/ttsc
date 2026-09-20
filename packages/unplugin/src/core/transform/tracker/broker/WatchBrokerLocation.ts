/**
 * One directory the watch broker watches for a registration.
 *
 * A location either watches the named entries of one directory (`names`) or,
 * with `recursive`, the whole tree below it. The name form is how exact-input
 * trackers keep their event traffic proportional to the inputs they own.
 */
export interface WatchBrokerLocation {
  /**
   * Directory to watch, as the registering tracker spells it: the walk's
   * spelling for the project tracker, the physical path for exact-input
   * trackers.
   */
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
  /**
   * Where the broker may write a probe to prove this location's stream has
   * delivered everything before a drain, on a backend that delivers with a
   * latency (samchon/ttsc#1453): a directory the adapter owns, below `root`,
   * which contains the location. The stream is then opened at `root`. Absent,
   * the location's stream cannot be proven, and a drain names its registration
   * unproven.
   */
  probe?: { directory: string; root: string };
}
