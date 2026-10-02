import type { ParseResult } from "./ParseResult";

/**
 * Return every string value accepted for a `repeatable` flag, in argv order.
 *
 * `values` keeps only the last occurrence, which is the wrong answer for a flag
 * whose whole point is repetition (`ttsx -r a -r b` preloads both). Returns an
 * empty array when the flag never appeared.
 *
 * @evidence contracts/common.md#principled-implementation Filtering the ordered repeated-value list with a typeof string predicate preserves the order and multiplicity of string occurrences while excluding incompatible value kinds.
 * @evidence contracts/common.md#clear-and-simple-design The accessor consumes the parser's dedicated repetition record rather than reparsing argv or reconstructing occurrences from the last-value map.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Repetition is a declared flag contract; the accessor neither deduplicates preloads nor substitutes fixture-specific ordering.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why values is insufficient and what absence returns, with separate purpose and rationale paragraphs following the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms Filtering R repeated entries costs O(R) time and at most O(R) returned storage; one traversal performs both narrowing and collection without reparsing argv or scanning unrelated flags.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This accessor receives caller-owned ParseResult values and produces an independently mutable array; it coordinates no stable producer identity or cross-request computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The newly allocated array transfers to the caller on return; the accessor owns no retained table, handle or task beyond the invocation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation getStringList computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
 */
export function getStringList(result: ParseResult, flag: string): string[] {
  return (result.repeated.get(flag) ?? []).filter(
    (value): value is string => typeof value === "string",
  );
}
