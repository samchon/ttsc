/**
 * Zero-based line and column of the first occurrence of `needle` in `text`, the
 * coordinates a source map records. Throws when `text` lacks it, so a test
 * never looks up a position that does not exist.
 */
export function positionOf(
  text: string,
  needle: string,
): { column: number; line: number } {
  const offset = text.indexOf(needle);
  if (offset < 0) {
    throw new Error(`${JSON.stringify(needle)} is not in the text`);
  }
  const before = text.slice(0, offset).split("\n");
  return { column: before.at(-1)!.length, line: before.length - 1 };
}
