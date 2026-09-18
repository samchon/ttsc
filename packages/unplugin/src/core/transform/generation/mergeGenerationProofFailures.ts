import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { recordGenerationProofFailure } from "./recordGenerationProofFailure";

/** Fold one bounded witness collection into another. */
export function mergeGenerationProofFailures(
  target: TtscGenerationProofFailures,
  source: TtscGenerationProofFailures,
): void {
  for (const failure of source.entries) {
    recordGenerationProofFailure(target, failure);
  }
  target.omitted = Math.min(
    Number.MAX_SAFE_INTEGER,
    target.omitted + source.omitted,
  );
}
