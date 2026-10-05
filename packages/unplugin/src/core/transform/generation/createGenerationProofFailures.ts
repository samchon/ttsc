import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/**
 * Create a fresh proof-witness collection for one transform attempt. Its
 * recorder bounds retained entries and their deduplication identities.
 *
 * @evidence contracts/common.md#principled-implementation Empty entries, zero omitted occurrences and an empty seen set establish the recorder's initial aggregate invariants.
 * @evidence contracts/common.md#clear-and-simple-design This constructor supplies only fresh aggregate storage; the recorder owns limits and identity composition.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An attempt receives independent storage rather than sharing mutable witnesses from an earlier compile or manufacturing an initial verdict.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies per-attempt ownership and the recorder's bounding responsibility before separated acknowledgments.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Fresh storage transfers to the attempt owner and its terminal diagnostic sequence; recordGenerationProofFailure bounds entry and identity counts at eight, while retained witness text follows supplied lengths. This constructor owns no handle or separate historical collection.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Allocates an empty collection.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Creates a new collection per attempt by definition.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Allocates an empty collection and reads no filesystem or path.
 */
export function createGenerationProofFailures(): TtscGenerationProofFailures {
  return { entries: [], omitted: 0, seen: new Set() };
}
