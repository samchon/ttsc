/** Compute 1-based line/column for a 0-based char offset into `source`. */
export function lineColumnOf(
  source: string,
  start: number | undefined,
): { line: number; column: number } {
  if (typeof start !== "number" || start < 0) return { line: 1, column: 1 };
  const slice = source.slice(0, Math.min(start, source.length));
  const newlines = slice.match(/\n/g);
  const line = newlines ? newlines.length + 1 : 1;
  const lastNewline = slice.lastIndexOf("\n");
  const column =
    lastNewline === -1 ? slice.length + 1 : slice.length - lastNewline;
  return { line, column };
}
