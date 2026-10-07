/**
 * What an attempt that adopted another worker's compile learned about the
 * publication it adopted (samchon/ttsc#1479).
 *
 * An adopted attempt that fails its proof fails for one of two reasons, and
 * they call for opposite retries. Either the publication does not hold on this
 * worker's disk: an input outside the walk moved since its publisher read it,
 * or a successful publication's graph or universal proofs fail here, which a
 * retry for the same state could find again, so the retry excludes that payload
 * while allowing a peer's replacement to undergo its own full proof. If none is
 * eligible, the lock owner compiles and replaces it. Or the publication held,
 * and it was this worker's own window that moved around it: a declared input's
 * metadata changed, the tracker heard an event, or the config moved during the
 * attempt. That says nothing against the publication, only that the project
 * moved, exactly as it would of a compile made here, so the retry claims the
 * state it then reads, adopting the same publication when the project's content
 * never changed. Diagnostic and successful publications retain external-state,
 * graph and universal input proof before adoption can be reused.
 *
 * @evidence contracts/common.md#principled-implementation Refutation and the claimed state are separate because a bad publication requires replacement, while a changed local proof window requires a new state claim.
 * @evidence contracts/common.md#clear-and-simple-design Two fields preserve the retry decision without storing another copy of the envelope or transient attempt state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The verdict does not label every failed attempt a corrupt publication or bypass the next snapshot proof.
 * @evidence contracts/common.md#meaningful-documentation The prose explains both failure classes and their opposite retries; each member's meaning remains explicit.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Carries an opaque publication-state key and logical refutation verdict;
 *   neither field defines native path identity, capability or process encoding.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscAdoptionVerdict only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscAdoptionVerdict only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscAdoptionVerdict only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export interface TtscAdoptionVerdict {
  /** Whether the publication itself failed its proof on this worker's disk. */
  refuted: boolean;

  /** The project state the publication was compiled for. */
  state: string;

  /** Digest of the exact adopted payload to exclude after refutation. */
  publication: string;
}
