import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";

export interface IResolvedGraphHandle {
  node?: ITtscGraphNode;
  candidates?: ITtscGraphNode[];
}

/**
 * Resolve a tool handle as an id, an exact symbol name, or a dotted suffix.
 *
 * A model writes handles from memory of an earlier result, and a `file#symbol`
 * id it half-remembers is the common miss: the symbol is right and the file is
 * one refactor stale (`effect.ts#track` for what now lives in `dep.ts`). The
 * graph knows that symbol, so it answers instead of sending the caller back
 * through a lookup — every such miss cost a round trip, and a specific-flow
 * question spends them by the handful.
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
    return byName;

  const symbol = symbolPartOf(handle);
  if (symbol !== undefined)
    return resolveGraphName(graph, symbol, candidateLimit);
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
