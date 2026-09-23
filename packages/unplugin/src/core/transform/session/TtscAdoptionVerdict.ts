/**
 * What an attempt that adopted another worker's compile learned about the
 * publication it adopted (samchon/ttsc#1479).
 *
 * An adopted attempt that fails its proof fails for one of two reasons, and
 * they call for opposite retries. Either the publication does not hold on this
 * worker's disk: an input outside the walk moved since its publisher read it,
 * or one of its graph proofs or universal inputs fails here, which a retry for
 * the same state would find again, so the retry compiles that state and
 * replaces the publication. Or the publication held, and it was this worker's
 * own window that moved around it: a declared input's metadata changed, the
 * tracker heard an event, or the config moved during the attempt. That says
 * nothing against the publication, only that the project moved, exactly as it
 * would of a compile made here, so the retry claims the state it then reads,
 * adopting the same publication when the project's content never changed.
 */
export interface TtscAdoptionVerdict {
  /** Whether the publication itself failed its proof on this worker's disk. */
  refuted: boolean;
  /** The project state the publication was compiled for. */
  state: string;
}
