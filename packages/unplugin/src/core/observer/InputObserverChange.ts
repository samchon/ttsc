/**
 * Which owners of an input observer (`createInputObserver`) one settled batch
 * of events changed.
 *
 * The two sets are disjoint: an owner that has both a changed input and a
 * membership change is in `reload` alone.
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
