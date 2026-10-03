/**
 * Which owners an input observer (`createInputObserver`) found to have changed
 * or unproved recorded input states in one settled batch.
 *
 * The two sets are disjoint: an owner that has both a changed input and a
 * membership change is in `reload` alone.
 *
 * @evidence contracts/common.md#principled-implementation Disjoint reload and invalidate sets distinguish failed non-membership state checks from membership-only failures; reload takes precedence when both occur.
 * @evidence contracts/common.md#clear-and-simple-design The observer reports owner identities and change category, leaving host-specific actions to the callback consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The result reports failed state comparisons, including unavailable proof, rather than fabricating a host reload or equating every event with changed compiler output.
 * @evidence contracts/common.md#meaningful-documentation The comment states set disjointness and explains why membership-only changes deserve a separate action.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Both sets carry native absolute owner registration spellings unchanged.
 *   Native registration resolves them; this result does not convert them to
 *   browser identifiers, fold case or certify physical alias equivalence.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   This result specifies categories and disjointness; observer checks and
 *   host callbacks own their processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This result defines no completed/in-flight computation coordinator;
 *   condition validation and host action sharing belong to their owners.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The observer creates these sets and hands them to its callback. This
 *   carrier defines no independent handle/task or retention policy.
 */
export interface InputObserverChange {
  /**
   * Owners whose only failed comparison concerns root-file membership, including
   * changed or unavailable membership proof, with no failed content state, so a
   * host that can tell the two apart re-runs them without an update of their
   * own (samchon/ttsc#1419).
   */
  invalidate: ReadonlySet<string>;

  /** Native owners with a changed or unproved non-membership input state. */
  reload: ReadonlySet<string>;
}
