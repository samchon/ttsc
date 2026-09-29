import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/**
 * Create a fresh proof-witness collection for one transform attempt.
 * Its recorder bounds retained entries and their deduplication identities.
 *
 * @evidence contracts/common.md#principled-implementation Empty entries, zero omitted occurrences and an empty seen set establish the recorder's initial aggregate invariants.
 * @evidence contracts/common.md#clear-and-simple-design This constructor supplies only fresh aggregate storage; the recorder owns limits and identity composition.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An attempt receives independent storage rather than sharing mutable witnesses from an earlier compile or manufacturing an initial verdict.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies per-attempt ownership and the recorder's bounding responsibility before separated acknowledgments.
 */
export function createGenerationProofFailures(): TtscGenerationProofFailures {
  return { entries: [], omitted: 0, seen: new Set() };
}
