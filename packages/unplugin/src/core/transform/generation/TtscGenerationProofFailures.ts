import type { TtscGenerationProofFailure } from "./TtscGenerationProofFailure";

/** Bounded proof witnesses for one transform attempt. */
export interface TtscGenerationProofFailures {
  /** Unique witnesses kept, at most `MAX_GENERATION_PROOF_FAILURES`. */
  entries: TtscGenerationProofFailure[];
  /** How many further witnesses were dropped after the bound. */
  omitted: number;
  /**
   * Keys of the kept witnesses, bounded with them so duplicates are not
   * recorded twice.
   */
  seen: Set<string>;
}
