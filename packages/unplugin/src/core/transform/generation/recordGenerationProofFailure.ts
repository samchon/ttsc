import type { TtscGenerationProofFailure } from "./TtscGenerationProofFailure";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/** Maximum witnesses printed and retained for each failed transform attempt. */
const MAX_GENERATION_PROOF_FAILURES = 8;

/** Retain one unique proof witness without allowing diagnostics to grow freely. */
export function recordGenerationProofFailure(
  failures: TtscGenerationProofFailures,
  failure: TtscGenerationProofFailure,
): void {
  const key = JSON.stringify([
    failure.domain,
    failure.kind,
    failure.path,
    failure.detail,
  ]);
  if (failures.seen.has(key)) return;
  if (failures.entries.length < MAX_GENERATION_PROOF_FAILURES) {
    // `seen` follows the same bound as `entries`: retaining every discarded
    // identity would make a bounded diagnostic an unbounded memory sink.
    failures.seen.add(key);
    failures.entries.push(failure);
  } else {
    failures.omitted = Math.min(Number.MAX_SAFE_INTEGER, failures.omitted + 1);
  }
}
