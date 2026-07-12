import { TtscGraphMemory } from "../model/TtscGraphMemory";

/**
 * How public a symbol is, counted from the graph and nothing else.
 *
 * A module's `exports` edges are the checker's export table, resolved through
 * every re-export and barrel it passes. So a symbol carries one edge per module
 * that puts it on the wire, and that count is the project's own answer to how
 * far forward the symbol stands: an internal helper is exported by the file
 * that declares it or by nothing at all, while the name a consumer imports from
 * the package has been re-exported up a chain of barrels and carries an edge
 * from each one.
 *
 * On zod the count is the whole difference between the current API and the
 * previous major it still ships: `parse` and `safeParse` in v4's classic
 * surface carry five, v3's `ZodString` carries three, and v3's
 * `ZodType.safeParse` — a class method, which no export table ever names —
 * carries none. A ranker that knew only the `exported` flag saw all of these as
 * equally public, picked the one whose name matched the question best, and
 * opened zod's tour on the legacy implementation.
 *
 * The count is a fact the compiler resolved. It reads no package.json, guesses
 * from no filename, and holds for a project that has neither.
 */
export function exportFanIn(graph: TtscGraphMemory, id: string): number {
  let count = 0;
  for (const edge of graph.incoming(id)) if (edge.kind === "exports") count++;
  return count;
}

/** True when the dump carries an export surface at all. */
export function hasExportSurface(graph: TtscGraphMemory): boolean {
  const known = cache.get(graph);
  if (known !== undefined) return known;
  const found = graph.edges.some((edge) => edge.kind === "exports");
  cache.set(graph, found);
  return found;
}

const cache = new WeakMap<TtscGraphMemory, boolean>();
