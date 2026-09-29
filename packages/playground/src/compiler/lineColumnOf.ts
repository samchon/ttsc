/**
 * Compute one-based line and column from a zero-based UTF-16 source offset.
 * Missing or negative offsets point to the beginning; offsets past EOF clamp.
 *
 * @evidence contracts/common.md#principled-implementation LF counts advance the line and the last LF determines the column in JavaScript string units, matching compiler source offsets.
 * @evidence contracts/common.md#clear-and-simple-design A stateless coordinate helper keeps source-location policy separate from diagnostic mapping and rendering.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Beginning and EOF behavior are general coordinate defaults rather than source-specific exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose states bases, units and boundary behavior, separated from tags under the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms One scan to the clamped UTF-16 offset costs O(offset) time and constant temporary space; it avoids prefix strings and newline arrays.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure coordinate conversion does not coordinate reuse across requests; callers own any source-index lifetime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It retains no state or handles after returning the coordinate pair.
 */
export function lineColumnOf(
  source: string,
  start: number | undefined,
): { line: number; column: number } {
  if (typeof start !== "number" || Number.isNaN(start) || start < 0)
    return { line: 1, column: 1 };
  const end = Math.min(Math.trunc(start), source.length);
  let line = 1;
  let lastNewline = -1;
  for (let index = 0; index < end; ++index) {
    if (source.charCodeAt(index) === 10) {
      ++line;
      lastNewline = index;
    }
  }
  const column = end - lastNewline;
  return { line, column };
}
