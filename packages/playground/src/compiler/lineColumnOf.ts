/**
 * Compute one-based line and column from a zero-based UTF-16 source offset.
 * Missing or negative offsets point to the beginning; offsets past EOF clamp.
 *
 * @evidence contracts/common.md#principled-implementation ECMAScript line terminators advance the line, CRLF counts once, and columns count JavaScript UTF-16 units.
 * @evidence contracts/common.md#clear-and-simple-design A stateless coordinate helper keeps source-location policy separate from diagnostic mapping and rendering.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Beginning and EOF behavior are general coordinate defaults rather than source-specific exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose states bases, units and boundary behavior, separated from tags under the documentation skill.
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
    const code = source.charCodeAt(index);
    if (code === 13 || code === 10 || code === 0x2028 || code === 0x2029) {
      if (code === 13 && source.charCodeAt(index + 1) === 10 && index + 1 < end)
        ++index;
      ++line;
      lastNewline = index;
    }
  }
  const column = end - lastNewline;
  return { line, column };
}
