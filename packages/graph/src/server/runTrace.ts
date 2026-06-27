import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphTrace } from "../structures/ITtscGraphTrace";
import { accessAliasesFor } from "./accessAliases";
import { resolveGraphHandle } from "./resolveHandle";
import { edgeEvidenceOf, signatureOf } from "./runExpand";

const DEFAULT_DEPTH = 6;
const DEFAULT_MAX_NODES = 30;
const MAX_OPEN_DEPTH = 6;
const MAX_OPEN_NODES = 30;
const MAX_HOPS_PER_NODE = 4;

/**
 * Breadth-first trace along the dependency graph. Structural
 * (contains/exports/imports) edges are excluded so the path is real call/type
 * flow; forward walks callees, reverse and impact walk callers. Impact
 * additionally tags each reached node's role so the blast radius on the public
 * surface is legible.
 */
export function runTrace(
  graph: TtscGraphMemory,
  props: ITtscGraphTrace.IProps,
): ITtscGraphTrace {
  const direction = props.direction ?? "forward";
  const focus = props.focus ?? "all";
  const maxDepth = bound(props.maxDepth, DEFAULT_DEPTH, 1, MAX_OPEN_DEPTH);
  const maxNodes = bound(props.maxNodes, DEFAULT_MAX_NODES, 1, MAX_OPEN_NODES);
  const maxHops = maxNodes * MAX_HOPS_PER_NODE;
  const reverse = direction === "reverse" || direction === "impact";
  // Only an impact trace tags reached nodes with their public-surface role; for
  // forward/reverse the role is noise.
  const withRoles = direction === "impact";

  const start = resolveGraphHandle(graph, props.from);
  if (start.candidates) {
    return {
      direction,
      hops: [],
      reached: [],
      truncated: false,
      candidates: start.candidates.map((n) => summary(graph, n)),
    };
  }
  if (start.node === undefined) {
    return { direction, hops: [], reached: [], truncated: false };
  }

  // Path mode: with `to`, return the dependency path from `from` to `to`, the
  // one-call answer for "how does A reach B", instead of an open-ended trace.
  if (props.to !== undefined && props.to !== "") {
    const base = { direction: "path", hops: [], reached: [], truncated: false };
    const target = resolveGraphHandle(graph, props.to);
    if (target.candidates) {
      return {
        ...base,
        start: summary(graph, start.node),
        candidates: target.candidates.map((n) => summary(graph, n)),
      };
    }
    if (target.node === undefined) {
      return { ...base, start: summary(graph, start.node) };
    }
    const found = findPath(
      graph,
      start.node.id,
      target.node.id,
      bound(props.maxDepth, 12, 1, 12),
      focus,
    );
    const path = found?.path ?? [];
    const hops = found?.hops ?? [];
    return {
      ...base,
      start: summary(graph, start.node),
      target: summary(graph, target.node),
      hops,
      path: path.map((node, i) => summary(graph, node, i, false, true)),
      steps: traceSteps(graph, hops),
      next: nextFromPath(path),
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
        if (!traversable(edge.kind, focus)) continue;
        const otherId = reverse ? edge.from : edge.to;
        const other = graph.node(otherId);
        if (other === undefined || other.kind === "file") continue;
        const hop: ITtscGraphTrace.IHop = {
          from: edge.from,
          to: edge.to,
          kind: edge.kind,
          depth: depth + 1,
        };
        const evidence = edgeEvidenceOf(edge);
        if (evidence !== undefined) hop.evidence = evidence;
        const aliases = accessAliasesFor(graph.node(edge.to), evidence?.text);
        if (aliases !== undefined) hop.aliases = aliases;
        // A back-edge to the start or an already-reached node: record the hop;
        // its endpoints are already represented.
        if (visited.has(otherId)) {
          if (hops.length >= maxHops) truncated = true;
          else hops.push(hop);
          continue;
        }
        // A new node past the cap is left unrepresented, so drop its hop too:
        // every hop's endpoints stay resolvable in `reached`/`start`.
        if (reached.size >= maxNodes) {
          truncated = true;
          continue;
        }
        if (hops.length >= maxHops) {
          truncated = true;
          continue;
        }
        visited.add(otherId);
        reached.set(otherId, summary(graph, other, depth + 1, withRoles));
        next.push({ id: otherId, depth: depth + 1 });
        hops.push(hop);
      }
    }
    queue = next;
  }

  return {
    start: summary(graph, start.node),
    direction,
    hops,
    reached: [...reached.values()],
    steps: traceSteps(graph, hops),
    next: {
      expand: [start.node.id, ...reached.keys()],
      traceFrom: [...reached.keys()],
    },
    truncated,
  };
}

function nextFromPath(path: ITtscGraphNode[]): ITtscGraphTrace.INext {
  return {
    expand: path.map((node) => node.id),
    traceFrom: path.length > 0 ? [path[path.length - 1]!.id] : [],
  };
}

function traceSteps(
  graph: TtscGraphMemory,
  hops: ITtscGraphTrace.IHop[],
): string[] {
  return hops.map((hop) => {
    const from = graph.node(hop.from);
    const to = graph.node(hop.to);
    const lhs = from?.qualifiedName ?? from?.name ?? hop.from;
    const rhs = to?.qualifiedName ?? to?.name ?? hop.to;
    const evidence =
      hop.evidence?.text === undefined ? "" : ` via ${hop.evidence.text}`;
    const aliases =
      hop.aliases === undefined ? "" : ` aliases ${hop.aliases.join(", ")}`;
    return `${lhs} -[${hop.kind}${evidence}${aliases}]-> ${rhs}`;
  });
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
  focus: ITtscGraphTrace.IProps["focus"],
): { path: ITtscGraphNode[]; hops: ITtscGraphTrace.IHop[] } | null {
  const startNode = graph.node(startId);
  if (startNode === undefined) return null;
  if (startId === targetId) return { path: [startNode], hops: [] };
  const parent = new Map<
    string,
    { via: string; kind: string; evidence?: ITtscGraphEvidence }
  >();
  const visited = new Set<string>([startId]);
  let queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
  while (queue.length > 0) {
    const next: Array<{ id: string; depth: number }> = [];
    for (const { id, depth } of queue) {
      if (depth >= maxDepth) continue;
      for (const edge of graph.outgoing(id)) {
        if (!traversable(edge.kind, focus)) continue;
        const otherId = edge.to;
        if (visited.has(otherId)) continue;
        const other = graph.node(otherId);
        if (other === undefined || other.kind === "file") continue;
        visited.add(otherId);
        const evidence = edgeEvidenceOf(edge);
        parent.set(otherId, { via: id, kind: edge.kind, evidence });
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
            const parentEdge = parent.get(node.id);
            const hop: ITtscGraphTrace.IHop = {
              from: path[i - 1]!.id,
              to: node.id,
              kind: parentEdge?.kind ?? "calls",
              depth: i,
            };
            if (parentEdge?.evidence !== undefined)
              hop.evidence = parentEdge.evidence;
            const aliases = accessAliasesFor(node, parentEdge?.evidence?.text);
            if (aliases !== undefined) hop.aliases = aliases;
            hops.push(hop);
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
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  depth?: number,
  withRoles = false,
  withSignature = false,
): ITtscGraphTrace.INode {
  const out: ITtscGraphTrace.INode = {
    id: node.id,
    name: node.qualifiedName ?? node.name,
    kind: node.kind,
    file: node.file,
  };
  if (depth !== undefined) out.depth = depth;
  if (withSignature) {
    const sig = signatureOf(graph.project, node);
    if (sig !== undefined) out.signature = sig;
  }
  if (withRoles) {
    const roles: string[] = [];
    if (node.exported) roles.push("exported");
    if (isTestFile(node.file)) roles.push("test");
    if (roles.length > 0) out.roles = roles;
  }
  return out;
}

/** An edge the trace should follow: a real dependency, not a structural edge. */
function traversable(
  kind: string,
  focus: ITtscGraphTrace.IProps["focus"],
): boolean {
  if (kind === "contains" || kind === "exports" || kind === "imports") {
    return false;
  }
  if (focus === "execution") {
    return (
      kind === "calls" ||
      kind === "instantiates" ||
      kind === "accesses" ||
      kind === "renders"
    );
  }
  if (focus === "types") {
    return (
      kind === "type_ref" ||
      kind === "extends" ||
      kind === "implements" ||
      kind === "overrides" ||
      kind === "decorates"
    );
  }
  return true;
}

function isTestFile(file: string): boolean {
  return (
    /(^|\/)(test|tests|__tests__|spec)\//.test(file) ||
    /\.(test|spec)\.[cm]?tsx?$/.test(file)
  );
}

function bound(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = value === undefined || !Number.isFinite(value) ? fallback : value;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
