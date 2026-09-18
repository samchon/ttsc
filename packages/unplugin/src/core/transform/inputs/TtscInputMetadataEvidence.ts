/**
 * One metadata observation: the signature plus whether the observed filesystem
 * has provably moved past every write-mintable stamp inside it.
 */
export interface TtscInputMetadataEvidence {
  /** The joined metadata signature of the lexical path and its link target. */
  signature: string;
  /** Whether a directory observer can account for every content mutation. */
  notificationAuthoritative: boolean;
  /**
   * Whether a later write is guaranteed to move this signature. Only a
   * signature captured with this evidence may be recorded to stand in for a
   * content comparison; without it, a same-length rewrite inside the stamp's
   * own clock tick would leave the signature unchanged.
   */
  separable: boolean;
}
