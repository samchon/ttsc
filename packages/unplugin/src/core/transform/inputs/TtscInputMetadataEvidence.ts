/**
 * One metadata observation: its signature and whether the observed filesystem
 * has provably moved past the link and target modification-stamp ticks.
 *
 * Notification authority and stamp separability answer independent reuse
 * premises; a signature alone does not imply either. The record carries no
 * watcher or clock-reference ownership.
 *
 * @evidence contracts/common.md#principled-implementation Separate signature, notification and clock facts preserve the distinctions needed to judge metadata-only or watcher-assisted validation.
 * @evidence contracts/common.md#clear-and-simple-design Three primitive fields expose one observation without embedding the observer, cached digest or mutation-tracker lifecycle.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation does not collapse a matching metadata string or silent watcher into unconditional content validity.
 * @evidence contracts/common.md#meaningful-documentation Native prose and spaced member documentation distinguish the three premises and resource boundary, with a blank acknowledgment separator under documentation guidance.
 */
export interface TtscInputMetadataEvidence {
  /** The joined metadata signature of the lexical path and its link target. */
  signature: string;

  /** Whether topology permits authority from a covering directory observer. */
  notificationAuthoritative: boolean;

  /**
   * Whether current device references separate the recorded modification ticks.
   * Without separation, a same-length rewrite inside a stamp's own tick can
   * leave the signature unchanged. Consumers must refresh references before
   * proving later reuse, because clock rollback can invalidate earlier evidence.
   */
  separable: boolean;
}
