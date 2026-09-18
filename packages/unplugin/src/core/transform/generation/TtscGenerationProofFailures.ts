import type { TtscGenerationProofFailure } from "./TtscGenerationProofFailure";

/** Bounded proof witnesses for one transform attempt. */
export interface TtscGenerationProofFailures {
  entries: TtscGenerationProofFailure[];
  omitted: number;
  seen: Set<string>;
}
