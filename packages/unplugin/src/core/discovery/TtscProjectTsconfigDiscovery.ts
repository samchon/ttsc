import type { TtscProjectTsconfigCandidate } from "./TtscProjectTsconfigCandidate";

/** The selected config and the predicates that selected it. */
export interface TtscProjectTsconfigDiscovery {
  readonly candidates: readonly TtscProjectTsconfigCandidate[];
  readonly file: string | undefined;
}
