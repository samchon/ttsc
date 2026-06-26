import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphTrace } from "../structures/ITtscGraphTrace";
import { signatureOf } from "./runExpand";

const DEFAULT_DEPTH = 6;
const DEFAULT_MAX_NODES = 60;

/**
 * Breadth-first trace along the dependency graph. Structural
 * (contains/exports/imports) edges are excluded so the path is real call/type
 * flow; forward walks callees, reverse and impact walk callers.
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

  // Path mode: with `to`, return the dependency path from `from` to `to` — the
  // one-call answer for "how does A reach B" — instead of an open-ended trace.
  if (props.to !== undefined && props.to !== "") {
    const base = { direction: "path", hops: [], reached: [], truncated: false };
    const target = resolveStart(graph, props.to);
    if (target.candidates) {
      return {
        ...base,
        start: summary(start.node),
        candidates: target.candidates.map((n) => summary(n)),
      };
    }
    if (target.node === undefined) {
      return { ...base, start: summary(start.node) };
    }
    const found = findPath(
      graph,
      start.node.id,
      target.node.id,
      Math.max(1, props.maxDepth ?? 12),
    );
    return {
      ...base,
      start: summary(start.node),
      target: summary(target.node),
      hops: found?.hops ?? [],
      path: (found?.path ?? []).map((node, i) => {
        const node_ = summary(node, i);
        const sig = signatureOf(graph.project, node);
        if (sig !== undefined) node_.signature = sig;
        return node_;
      }),
    };
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
        if (!traversable(edge.kind)) continue;
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
 * The shortest dependency path from `startId` to `targetId` over real (non-
 * structural) forward edges, breadth-first, or null when `targetId` is not
 * reachable within maxDepth. Returns the nodes in order and the hops between.
 */
function findPath(
  graph: TtscGraphMemory,
  startId: string,
  targetId: string,
  maxDepth: number,
): { path: ITtscGraphNode[]; hops: ITtscGraphTrace.IHop[] } | null {
  const startNode = graph.node(startId);
  if (startNode === undefined) return null;
  if (startId === targetId) return { path: [startNode], hops: [] };
  const parent = new Map<string, { via: string; kind: string }>();
  const visited = new Set<string>([startId]);
  let queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
  while (queue.length > 0) {
    const next: Array<{ id: string; depth: number }> = [];
    for (const { id, depth } of queue) {
      if (depth >= maxDepth) continue;
      for (const edge of graph.outgoing(id)) {
        if (!traversable(edge.kind)) continue;
        const otherId = edge.to;
        if (visited.has(otherId)) continue;
        const other = graph.node(otherId);
        if (other === undefined || other.kind === "file") continue;
        visited.add(otherId);
        parent.set(otherId, { via: id, kind: edge.kind });
        if (otherId === targetId) {
          const ids: string[] = [otherId];
          let cur = otherId;
          while (cur !== startId) {
            const p = parent.get(cur);
            if (p === undefined) break;
            ids.unshift(p.via);
            cur = p.via;
          }
          const path: ITtscGraphNode[] = [];
          for (const nid of ids) {
            const n = graph.node(nid);
            if (n !== undefined) path.push(n);
          }
          const hops: ITtscGraphTrace.IHop[] = [];
          for (let i = 1; i < path.length; i++) {
            const node = path[i]!;
            hops.push({
              from: path[i - 1]!.id,
              to: node.id,
              kind: parent.get(node.id)?.kind ?? "calls",
              depth: i,
            });
          }
          return { path, hops };
        }
        next.push({ id: otherId, depth: depth + 1 });
      }
    }
    queue = next;
  }
  return null;
}

/**
 * Summarize a node for a trace result. With `withRoles`, tag the public-surface
 * roles (exported / test) an impact trace reports; other directions omit them.
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
    if (isTestFile(node.file)) roles.push("test");
    if (roles.length > 0) out.roles = roles;
  }
  return out;
}

/** An edge the trace should follow: a real dependency, not a structural edge. */
function traversable(kind: string): boolean {
  return kind !== "contains" && kind !== "exports" && kind !== "imports";
}

function isTestFile(file: string): boolean {
  return (
    /(^|\/)(test|tests|__tests__|spec)\//.test(file) ||
    /\.(test|spec)\.[cm]?tsx?$/.test(file)
  );
}
