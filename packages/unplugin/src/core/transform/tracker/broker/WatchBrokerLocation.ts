/**
 * One directory the watch broker watches for a registration.
 *
 * A location describes a native directory or, with `recursive`, its subtree.
 * Exact-input callers can also send requested names, but the current child
 * does not use that list as a basename filter: alternative native event names
 * must reach the parent's identity/uncertainty classifier. The shape does not
 * promise event traffic proportional to named input count.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Directory/subtree scope and caller-requested names remain distinct from
 *   optional probe ownership. Requested spelling equality cannot establish
 *   native alias inequality, so the child forwards names without this filter.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One location record supplies opening data; registration-level sinks and
 *   lifetime state are not duplicated per location.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A probe-dependent stream without usable probe capability stays unproven.
 *   Other backend drain mechanisms belong to the child implementation, not a
 *   universal latency or capability guarantee from this carrier.
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
   * Requested entry spellings from exact-input callers. Retained in the opening
   * protocol, but not used by the current child as a native-name prefilter.
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
   * drain's probe did. When absent or unusable on a probe-dependent stream, a
   * drain names the location unproven. Non-probe backend draining follows its
   * own mechanism; this field alone does not certify delivery.
   */
  probe?: { directory: string; root: string };
}
