import { TtscGraphMemory } from "../model/TtscGraphMemory";
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
 */
export function resolveGraphHandle(
  graph: TtscGraphMemory,
  handle: string,
  candidateLimit = 12,
): IResolvedGraphHandle {
  const byId = graph.node(handle);
  if (byId !== undefined) return { node: byId };

  const byName = resolveGraphName(graph, handle, candidateLimit);
  if (byName.node !== undefined || byName.candidates !== undefined)
    return rank(graph, byName, candidateLimit);

  const byFile = resolveFileQualified(graph, handle, candidateLimit);
  if (byFile.node !== undefined || byFile.candidates !== undefined)
    return rank(graph, byFile, candidateLimit);

  const symbol = symbolPartOf(handle);
  if (symbol !== undefined)
    return rank(
      graph,
      resolveGraphName(graph, symbol, candidateLimit),
      candidateLimit,
    );
  return {};
}

/** The symbol an id-shaped handle names: `dir/file.ts#Class.method:kind`. */
function symbolPartOf(handle: string): string | undefined {
  const hash = handle.lastIndexOf("#");
  if (hash < 0) return undefined;
  const symbol = handle.slice(hash + 1);
  const kind = symbol.lastIndexOf(":");
  const name = kind < 0 ? symbol : symbol.slice(0, kind);
  return name.length > 0 ? name : undefined;
}

function resolveGraphName(
  graph: TtscGraphMemory,
  name: string,
  candidateLimit: number,
): IResolvedGraphHandle {
  const exact = graph.symbols(name);
  if (exact.length === 1) return { node: exact[0] };
  if (exact.length > 1) return { candidates: exact.slice(0, candidateLimit) };

  if (name.includes(".")) {
    const suffix = `.${name}`;
    const suffixMatches = graph.nodes.filter(
      (node) =>
        node.kind !== "file" && node.qualifiedName?.endsWith(suffix) === true,
    );
    if (suffixMatches.length === 1) return { node: suffixMatches[0] };
    if (suffixMatches.length > 1) {
      return { candidates: suffixMatches.slice(0, candidateLimit) };
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
  candidateLimit: number,
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
  if (matches.length > 1)
    return { candidates: matches.slice(0, candidateLimit) };
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
  const ranked = [...resolved.candidates]
    .sort((a, b) => candidateScore(graph, b) - candidateScore(graph, a))
    .slice(0, candidateLimit);
  return { candidates: ranked };
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
