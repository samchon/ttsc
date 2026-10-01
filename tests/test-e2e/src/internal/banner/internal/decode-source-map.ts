/**
 * Decodes the cumulative source-line field (the 3rd VLQ field) of every mapping
 * segment in a source map `mappings` string. Source line is cumulative across
 * the whole string; segments without a source position are skipped. Shared by
 * the banner source-map feature tests so each does not re-implement the
 * decoder.
 */
export function decodeSourceLines(mappings: string): number[] {
  const BASE64 =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const decodeSegment = (segment: string): number[] => {
    const fields: number[] = [];
    let shift = 0;
    let value = 0;
    for (const char of segment) {
      const digit = BASE64.indexOf(char);
      const continuation = digit & 32;
      value += (digit & 31) << shift;
      if (continuation) {
        shift += 5;
        continue;
      }
      fields.push(value & 1 ? -(value >> 1) : value >> 1);
      shift = 0;
      value = 0;
    }
    return fields;
  };

  const lines: number[] = [];
  let sourceLine = 0;
  for (const group of mappings.split(";")) {
    if (group === "") continue;
    for (const segment of group.split(",")) {
      if (segment === "") continue;
      const fields = decodeSegment(segment);
      const sourceLineDelta = fields[2];
      if (sourceLineDelta === undefined) continue;
      sourceLine += sourceLineDelta;
      lines.push(sourceLine);
    }
  }
  return lines;
}
