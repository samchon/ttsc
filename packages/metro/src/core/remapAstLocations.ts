/**
 * Move every source location in an upstream transformer's AST from the ttsc
 * transformed text back to the text the module's author wrote
 * (samchon/ttsc#1392).
 *
 * Metro's Babel transformer contract returns an AST, never a map, and Metro
 * builds the module's source map from that AST's `loc` positions against the
 * file it read. The upstream transformer parsed the ttsc transformed text, so
 * without this pass every position after the first change points at the
 * reprinted lines: breakpoints, stack traces, and the error overlay would all
 * be off. Each node's `loc` start and end are looked up in `map` with the usual
 * greatest-lower-bound rule. A node whose start has no mapping into `file`,
 * such as generated code, loses its `loc`, which Babel treats as a synthesized
 * node, so it takes the mapping of the code around it.
 *
 * @param ast The upstream transformer's AST, rewritten in place.
 * @param map The adapter's map from the transformed text to `file`, with
 *   absolute `sources`.
 * @param file Absolute path of the module.
 */
export function remapAstLocations(
  ast: unknown,
  map: { mappings: string; sources: readonly string[] },
  file: string,
): void {
  const normalize = (location: string) => {
    const slashed = location.replace(/\\/g, "/");
    return process.platform === "win32" ? slashed.toLowerCase() : slashed;
  };
  const own = map.sources.findIndex(
    (source) => normalize(source) === normalize(file),
  );
  if (own < 0) {
    return;
  }
  const lines = decodeSegments(map.mappings);
  const locate = (
    position: unknown,
  ): { column: number; line: number } | undefined => {
    if (typeof position !== "object" || position === null) return undefined;
    const { column, line } = position as { column?: unknown; line?: unknown };
    if (typeof line !== "number" || typeof column !== "number") {
      return undefined;
    }
    const segments = lines[line - 1];
    if (segments === undefined) return undefined;
    let low = 0;
    let high = segments.length - 1;
    let found: Segment | undefined;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const segment = segments[middle]!;
      if (segment.generatedColumn <= column) {
        found = segment;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return found === undefined || found.source !== own
      ? undefined
      : { column: found.column, line: found.line + 1 };
  };

  const visited = new Set<object>();
  const pending: unknown[] = [ast];
  while (pending.length !== 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) {
      continue;
    }
    visited.add(value);
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    const node = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(node)) {
      if (key !== "loc") pending.push(child);
    }
    const loc = node.loc;
    if (typeof loc !== "object" || loc === null) continue;
    const { end, start } = loc as { end?: unknown; start?: unknown };
    const mappedStart = locate(start);
    if (mappedStart === undefined) {
      node.loc = null;
      continue;
    }
    const mappedEnd = locate(end);
    node.loc = {
      ...loc,
      end:
        mappedEnd === undefined ||
        mappedEnd.line < mappedStart.line ||
        (mappedEnd.line === mappedStart.line &&
          mappedEnd.column < mappedStart.column)
          ? mappedStart
          : mappedEnd,
      start: mappedStart,
    };
  }
}

/** One decoded mapping on a generated line. */
interface Segment {
  /** Zero-based generated column. */
  generatedColumn: number;
  /** Index into the map's `sources`, or `-1` for an unmapped segment. */
  source: number;
  /** Zero-based source line. */
  line: number;
  /** Zero-based source column. */
  column: number;
}

/**
 * Decode `mappings` into its segments per generated line, in column order.
 * Segments of every source are kept, and a segment with no source position is
 * kept with source `-1`, so a lookup that lands on either reports no position
 * instead of reaching past it to an earlier mapping.
 */
function decodeSegments(mappings: string): Segment[][] {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lines: Segment[][] = [];
  let source = 0;
  let line = 0;
  let column = 0;
  for (const text of mappings.split(";")) {
    const segments: Segment[] = [];
    let generatedColumn = 0;
    for (const encoded of text.split(",")) {
      if (encoded === "") continue;
      const fields: number[] = [];
      let value = 0;
      let shift = 0;
      for (const char of encoded) {
        const digit = alphabet.indexOf(char);
        if (digit < 0) return lines;
        value += (digit & 31) << shift;
        if ((digit & 32) !== 0) {
          shift += 5;
          continue;
        }
        fields.push((value & 1) !== 0 ? -(value >>> 1) : value >>> 1);
        value = 0;
        shift = 0;
      }
      generatedColumn += fields[0] ?? 0;
      if (fields.length < 4) {
        segments.push({ column: 0, generatedColumn, line: 0, source: -1 });
        continue;
      }
      source += fields[1]!;
      line += fields[2]!;
      column += fields[3]!;
      segments.push({ column, generatedColumn, line, source });
    }
    lines.push(segments);
  }
  return lines;
}
