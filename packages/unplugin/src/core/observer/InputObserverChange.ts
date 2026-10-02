/**
 * Which owners of an input observer (`createInputObserver`) one settled batch
 * of events changed.
 *
 * The two sets are disjoint: an owner that has both a changed input and a
 * membership change is in `reload` alone.
 *
 * @evidence contracts/common.md#principled-implementation Disjoint reload and invalidate sets distinguish changed delivered inputs from membership-only changes, with reload taking precedence when both occur.
 * @evidence contracts/common.md#clear-and-simple-design The observer reports owner identities and change category, leaving host-specific actions to the callback consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The result records observed changes rather than fabricating a host reload or equating every event with changed compiler output.
 * @evidence contracts/common.md#meaningful-documentation The comment states set disjointness and explains why membership-only changes deserve a separate action.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   InputObserverChange only declares a shape; it has no filesystem, path or
 *   process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   InputObserverChange only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   InputObserverChange only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   InputObserverChange only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export interface InputObserverChange {
  /**
   * Owners whose only change is the project's root-file membership: a root file
   * appeared or left, which changes no input their last delivery read, so a
   * host that can tell the two apart re-runs them without an update of their
   * own (samchon/ttsc#1419).
   */
  invalidate: ReadonlySet<string>;

  /** Owners an input of whose last delivery changed, by absolute spelling. */
  reload: ReadonlySet<string>;
}
