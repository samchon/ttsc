import type { TtscGenerationProofFailure } from "./TtscGenerationProofFailure";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/** Maximum witnesses printed and retained for each failed transform attempt. */
const MAX_GENERATION_PROOF_FAILURES = 8;

/**
 * Retain one unique proof witness without allowing diagnostics to grow freely.
 * Duplicate identities of retained entries are ignored. Once the collection is
 * full, new occurrences increment a saturated omitted count; dropped identities
 * are not retained, so later repetitions of a dropped witness count again.
 *
 * @evidence contracts/common.md#principled-implementation A JSON tuple of domain, kind, path and detail defines witness identity, seen deduplicates retained entries and the entry bound plus saturated omitted counter represent evidence loss explicitly.
 * @evidence contracts/common.md#clear-and-simple-design One recorder owns identity, retained bounds and omission accounting so merge and capture callers share the same aggregate policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The eight-entry bound limits diagnostic storage rather than changing the proof verdict; omitted remains visible and no discarded witness is certified irrelevant.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state retained duplicate handling and the dropped-occurrence limitation, while the internal comment explains why seen shares the storage bound.
 * @evidence contracts/performance.md#efficient-algorithms Identity encoding costs the witness text length and Set membership is direct; insertion touches one entry without rescanning the aggregate.
 * @evidence contracts/performance.md#reuse-equivalent-work Retained seen keys prevent repeated insertion of the same printable witness; dropped identities intentionally are not shared because doing so would require unbounded storage.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Entries and seen retain at most eight witnesses/keys per attempt, and omitted saturates at MAX_SAFE_INTEGER; text bytes depend on producer witness lengths rather than a claimed byte-size bound.
 */
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
