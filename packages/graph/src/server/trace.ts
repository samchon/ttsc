import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphTrace } from "../structures/ITtscGraphTrace";

const DEFAULT_DEPTH = 6;
const DEFAULT_MAX_NODES = 60;

/**
 * Breadth-first trace along the dependency graph. Structural
 * (contains/exports/imports) and heuristic edges are excluded so the path is
 * real call/type flow; forward walks callees, reverse and impact walk callers.
 * Impact additionally tags each reached node's role so the blast radius on the
 * public surface is legible.
 */
export function runTrace(
  graph: TtscGraphMemory,
  props: ITtscGraphTrace.IProps,
): ITtscGraphTrace {
  const direction = props.direction ?? "forward";
  const maxDepth = Math.max(1, props.maxDepth ?? DEFAULT_DEPTH);
  const maxNodes = Math.max(1, props.maxNodes ?? DEFAULT_MAX_NODES);
  const reverse = direction === "reverse" || direction === "impact";
  // Only an impact trace tags reached nodes with their public-surface role; for
  // forward/reverse the role is noise.
  const withRoles = direction === "impact";

  const start = resolveStart(graph, props.from);
  if (start.candidates) {
    return {
      direction,
      hops: [],
      reached: [],
      truncated: false,
      candidates: start.candidates.map((n) => summary(n)),
    };
  }
  if (start.node === undefined) {
    return { direction, hops: [], reached: [], truncated: false };
  }

  const hops: ITtscGraphTrace.IHop[] = [];
  const reached = new Map<string, ITtscGraphTrace.INode>();
  const visited = new Set<string>([start.node.id]);
  let queue: Array<{ id: string; depth: number }> = [
    { id: start.node.id, depth: 0 },
  ];
  let truncated = false;

  while (queue.length > 0) {
    const next: Array<{ id: string; depth: number }> = [];
    for (const { id, depth } of queue) {
      if (depth >= maxDepth) {
        truncated = true;
        continue;
      }
      const edges = reverse ? graph.incoming(id) : graph.outgoing(id);
      for (const edge of edges) {
        if (!traversable(edge.kind, edge.provenance)) continue;
        const otherId = reverse ? edge.from : edge.to;
        const other = graph.node(otherId);
        if (other === undefined || other.kind === "file") continue;
        const hop = {
          from: edge.from,
          to: edge.to,
          kind: edge.kind,
          depth: depth + 1,
        };
        // A back-edge to the start or an already-reached node: record the hop;
        // its endpoints are already represented.
        if (visited.has(otherId)) {
          hops.push(hop);
          continue;
        }
        // A new node past the cap is left unrepresented, so drop its hop too —
        // every hop's endpoints stay resolvable in `reached`/`start`.
        if (reached.size >= maxNodes) {
          truncated = true;
          continue;
        }
        visited.add(otherId);
        reached.set(otherId, summary(other, depth + 1, withRoles));
        next.push({ id: otherId, depth: depth + 1 });
        hops.push(hop);
      }
    }
    queue = next;
  }

  return {
    start: summary(start.node),
    direction,
    hops,
    reached: [...reached.values()],
    truncated,
  };
}

/** Resolve `from` to a single node, or report ambiguous-name candidates. */
function resolveStart(
  graph: TtscGraphMemory,
  from: string,
): { node?: ITtscGraphNode; candidates?: ITtscGraphNode[] } {
  const byId = graph.node(from);
  if (byId !== undefined) return { node: byId };
  const named = graph.named(from).filter((n) => n.kind !== "file");
  if (named.length === 1) return { node: named[0] };
  if (named.length > 1) return { candidates: named.slice(0, 12) };
  return {};
}

/**
 * Summarize a node for a trace result. With `withRoles`, tag the public-surface
 * roles (exported / route / test) an impact trace reports; other directions
 * omit them.
 */
function summary(
  node: ITtscGraphNode,
  depth?: number,
  withRoles = false,
): ITtscGraphTrace.INode {
  const out: ITtscGraphTrace.INode = {
    id: node.id,
    name: node.qualifiedName ?? node.name,
    kind: node.kind,
    file: node.file,
  };
  if (depth !== undefined) out.depth = depth;
  if (withRoles) {
    const roles: string[] = [];
    if (node.exported) roles.push("exported");
    if (node.kind === "route") roles.push("route");
    if (isTestFile(node.file)) roles.push("test");
    if (roles.length > 0) out.roles = roles;
  }
  return out;
}

/** An edge the trace should follow: real dependency, not structure or guess. */
function traversable(kind: string, provenance: string): boolean {
  if (provenance === "heuristic") return false;
  return kind !== "contains" && kind !== "exports" && kind !== "imports";
}

function isTestFile(file: string): boolean {
  return (
    /(^|\/)(test|tests|__tests__|spec)\//.test(file) ||
    /\.(test|spec)\.[cm]?tsx?$/.test(file)
  );
}
