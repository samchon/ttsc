/**
 * One directory the watch broker watches for a registration.
 *
 * A location either watches the named entries of one directory (`names`) or,
 * with `recursive`, the whole tree below it. The name form is how exact-input
 * trackers keep their event traffic proportional to the inputs they own.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Named entries and recursive trees express observation scope; optional probe
 *   ownership is separate from the directory whose events are classified.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One location record supplies opening data; registration-level sinks and
 *   lifetime state are not duplicated per location.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Missing probe capability remains explicitly unproven rather than treating
 *   backend latency as a guessed fixed-delay proof.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and separated member comments explain named scopes and
 *   probe containment under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral callers supply paths in their own spelling; the broker translates
 *   canonical native paths and confines probe semantics to capable backends.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   WatchBrokerLocation only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   WatchBrokerLocation only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   WatchBrokerLocation only declares a shape; it has no handle or retained
 *   state at runtime.
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
   * delivered everything before a moment, on a backend that delivers with a
   * latency (samchon/ttsc#1453): a directory the adapter owns, below `root`,
   * which contains the location. The stream is then opened at `root`, reports
   * ready once its opening probe came back, and answers each drain once that
   * drain's probe did. Absent, the location's stream cannot be proven, and a
   * drain names this location unproven.
   */
  probe?: { directory: string; root: string };
}
