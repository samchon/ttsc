import type { TtscProjectTsconfigCandidate } from "./TtscProjectTsconfigCandidate";

/** The selected config and the predicates that selected it. */
export interface TtscProjectTsconfigDiscovery {
  /** Every candidate probed, nearest first, including the ones rejected. */
  readonly candidates: readonly TtscProjectTsconfigCandidate[];
  /** The selected config, or `undefined` when no ancestor holds one. */
  readonly file: string | undefined;
}
