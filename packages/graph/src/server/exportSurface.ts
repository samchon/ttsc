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
 *
 * @evidence contracts/common.md#principled-implementation Counting incoming exports edges reports modules whose checker-resolved export tables publish this exact node.
 * @evidence contracts/common.md#clear-and-simple-design One predicate supplies the graph-derived public-surface signal to handle and tour ranking.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No package.json, file-name front-door guess or named project's expected score substitutes for export relationships.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain barrel/re-export propagation and distinguish edge count from declaring-file exported status.
 * @evidence contracts/performance.md#efficient-algorithms The incoming index restricts counting to this node's degree instead of scanning every graph edge.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This count is a primitive over an already shared generation index; caller-owned rank computation decides any broader reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Counting borrows indexed edges and retains only a scalar local accumulator.
 */
export function exportFanIn(graph: TtscGraphMemory, id: string): number {
  let count = 0;
  for (const edge of graph.incoming(id)) if (edge.kind === "exports") count++;
  return count;
}

/**
 * True when the graph carries an exports edge at all.
 *
 * The answer is cached by immutable graph generation, including false.
 *
 * @evidence contracts/common.md#principled-implementation Existence of an exports edge establishes collection of at least one module surface without guessing from local declaration flags.
 * @evidence contracts/common.md#clear-and-simple-design A WeakMap holds the generation-wide predicate result for all rankers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A false cached answer is retained as a real result rather than mistaken for a cache miss.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the edge criterion and generation-scoped caching.
 * @evidence contracts/performance.md#efficient-algorithms The first check scans edges until a match; later lookups are map accesses.
 * @evidence contracts/performance.md#reuse-equivalent-work The model's owned frozen facts make graph identity a stable generation key; a new generation is a different key and does not inherit the result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources WeakMap entries follow graph reachability and do not retain historical graph generations.
 */
export function hasExportSurface(graph: TtscGraphMemory): boolean {
  const known = cache.get(graph);
  if (known !== undefined) return known;
  const found = graph.edges.some((edge) => edge.kind === "exports");
  cache.set(graph, found);
  return found;
}

const cache = new WeakMap<TtscGraphMemory, boolean>();
