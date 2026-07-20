import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { parseTtscGraphNodeId } from "../model/TtscGraphNodeId";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { exportFanIn } from "./exportSurface";
import { isSupportPath } from "./pathPolicy";

export interface IResolvedGraphHandle {
  node?: ITtscGraphNode;
  candidates?: ITtscGraphNode[];
}

/**
 * Resolve a tool handle as an id, an exact symbol name, a dotted suffix, or a
 * file-qualified name.
 *
 * A model writes handles from memory of an earlier result, and it writes them
 * the way the result read: a symbol with the file it came from. Three forms all
 * mean one node and all used to miss.
 *
 * - A `file#symbol` id whose file is one refactor stale (`effect.ts#track` for
 *   what now lives in `dep.ts`). The graph knows the symbol, so it answers
 *   rather than sending the caller back through a lookup.
 * - `renderer.render` — the file's stem and the symbol it declares. It is not a
 *   qualified name, so a suffix match on `.render` finds nothing and the caller
 *   gets an empty result for a symbol the graph holds. Vue's tour spent a trace
 *   call and four file reads on exactly this.
 * - A name the project declares more than once, which is not a name the project
 *   does not declare. The candidates come back ranked by what the package
 *   publishes, so the one a caller means is the one it reads first.
 * - `schema.parse` — a call written the way it is written in a program, on a
 *   value rather than on the type that declares it. There is no `schema` in the
 *   graph, so every exact form misses, and the handle resolves to nothing for a
 *   member the graph holds under `ZodType.parse`. It is how people name a
 *   method (`db.query`, `app.listen`, `repo.save`), so the member is what it
 *   means, and the candidates come back ranked when several classes declare
 *   it.
 */
export function resolveGraphHandle(
  graph: TtscGraphMemory,
  handle: string,
  candidateLimit = 12,
): IResolvedGraphHandle {
  const byId = graph.node(handle);
  if (byId !== undefined) return { node: byId };

  const byName = resolveGraphName(graph, handle);
  if (byName.node !== undefined || byName.candidates !== undefined)
    return rank(graph, byName, candidateLimit);

  const byFile = resolveFileQualified(graph, handle);
  if (byFile.node !== undefined || byFile.candidates !== undefined)
    return rank(graph, byFile, candidateLimit);

  const symbol = symbolPartOf(handle) ?? memberPartOf(handle);
  if (symbol !== undefined)
    return rank(graph, resolveGraphName(graph, symbol), candidateLimit);
  return {};
}

/**
 * The member a dotted handle names when its receiver is a value: the last
 * segment of `schema.parse`, of `this.store.commit`, of `db.query`.
 *
 * It is the last thing tried, after the whole handle has failed as an id, as a
 * qualified name, as a `.suffix`, and as a file-qualified name — so a receiver
 * that _is_ a type or a file never reaches here.
 */
function memberPartOf(handle: string): string | undefined {
  const dot = handle.lastIndexOf(".");
  if (dot <= 0) return undefined;
  const member = handle.slice(dot + 1);
  return member.length > 0 ? member : undefined;
}

/** The symbol an id-shaped handle names: `dir/file.ts#Class.method:kind`. */
function symbolPartOf(handle: string): string | undefined {
  return parseTtscGraphNodeId(handle)?.name;
}

function resolveGraphName(
  graph: TtscGraphMemory,
  name: string,
): IResolvedGraphHandle {
  const exact = graph.symbols(name);
  if (exact.length === 1) return { node: exact[0] };
  if (exact.length > 1) return { candidates: [...exact] };

  if (name.includes(".")) {
    const suffix = `.${name}`;
    const suffixMatches = graph.nodes.filter(
      (node) =>
        node.kind !== "file" && node.qualifiedName?.endsWith(suffix) === true,
    );
    if (suffixMatches.length === 1) return { node: suffixMatches[0] };
    if (suffixMatches.length > 1) {
      return { candidates: suffixMatches };
    }
  }
  return {};
}

/**
 * A `file.symbol` handle: the stem of the file a result cited, then the symbol
 * it declared there (`renderer.render`, `parse.safeParse`). It is how a model
 * disambiguates a common name from what the graph just showed it, and it names
 * exactly one node whenever that file declares the symbol.
 */
function resolveFileQualified(
  graph: TtscGraphMemory,
  handle: string,
): IResolvedGraphHandle {
  const dot = handle.indexOf(".");
  if (dot <= 0) return {};
  const stem = handle.slice(0, dot).toLowerCase();
  const name = handle.slice(dot + 1);
  if (name === "") return {};
  const matches = graph
    .symbols(name)
    .filter((node) => fileStem(node.file) === stem);
  if (matches.length === 1) return { node: matches[0] };
  if (matches.length > 1) return { candidates: matches };
  return {};
}

/** `packages/core/src/renderer.ts` -> `renderer`. */
function fileStem(file: string): string {
  const base = file.slice(file.lastIndexOf("/") + 1);
  return base.replace(/\.[cm]?[tj]sx?$/, "").toLowerCase();
}

/**
 * Order candidates by how likely a caller means them: what the package
 * publishes first, then how much of the codebase leans on the node, with test
 * and fixture declarations last. An unranked list hands back whichever
 * declaration the graph happened to visit first — Vue's `render` came back as a
 * template pre-processor's method — and a caller that trusts the order traces
 * the wrong one.
 */
function rank(
  graph: TtscGraphMemory,
  resolved: IResolvedGraphHandle,
  candidateLimit: number,
): IResolvedGraphHandle {
  if (resolved.candidates === undefined) return resolved;
  const ranked = resolved.candidates
    .map((node) => ({ node, score: candidateScore(graph, node) }))
    .sort((a, b) => {
      const score = b.score - a.score;
      return score !== 0 ? score : compareIdentity(a.node.id, b.node.id);
    })
    .slice(0, candidateLimit)
    .map(({ node }) => node);
  return { candidates: ranked };
}

/** Compare position-invariant ids without locale-dependent collation. */
function compareIdentity(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function candidateScore(graph: TtscGraphMemory, node: ITtscGraphNode): number {
  let score = Math.min(48, Math.log2(1 + exportFanIn(graph, node.id)) * 20);
  if (node.exported) score += 12;
  if (node.external) score -= 60;
  if (isSupportPath(node.file)) score -= 30;
  const degree =
    graph.outgoing(node.id).length + graph.incoming(node.id).length;
  score += Math.min(24, Math.log2(1 + degree) * 6);
  return score;
}
