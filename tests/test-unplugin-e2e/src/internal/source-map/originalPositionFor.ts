/**
 * Look up where a generated position came from under a version 3 source map, by
 * the greatest-lower-bound rule consumers such as browsers use.
 *
 * Lines and columns are zero-based. Returns `undefined` when no segment on the
 * generated line starts at or before the column, or when the nearest one has no
 * source position.
 */
export function originalPositionFor(
  map: { mappings: string; sources: readonly string[] },
  line: number,
  column: number,
): { column: number; line: number; source: string } | undefined {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let source = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  const lines = map.mappings.split(";");
  for (let index = 0; index < lines.length; index += 1) {
    let generatedColumn = 0;
    let found: { column: number; line: number; source: string } | undefined;
    let stopped = false;
    for (const encoded of lines[index]!.split(",")) {
      if (encoded === "") continue;
      const fields: number[] = [];
      let value = 0;
      let shift = 0;
      for (const char of encoded) {
        const digit = alphabet.indexOf(char);
        value += (digit & 31) << shift;
        if ((digit & 32) !== 0) {
          shift += 5;
          continue;
        }
        fields.push((value & 1) !== 0 ? -(value >>> 1) : value >>> 1);
        value = 0;
        shift = 0;
      }
      generatedColumn += fields[0]!;
      const mapped = fields.length >= 4;
      if (mapped) {
        source += fields[1]!;
        sourceLine += fields[2]!;
        sourceColumn += fields[3]!;
      }
      if (index !== line || stopped) continue;
      if (generatedColumn > column) {
        stopped = true;
        continue;
      }
      found = mapped
        ? {
            column: sourceColumn,
            line: sourceLine,
            source: map.sources[source]!,
          }
        : undefined;
    }
    if (index === line) return found;
  }
  return undefined;
}
