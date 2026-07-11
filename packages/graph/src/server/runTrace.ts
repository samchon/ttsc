import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphTrace } from "../structures/ITtscGraphTrace";
import { isExternalNode, isTestPath } from "./pathPolicy";
import { resolveGraphHandle } from "./resolveHandle";
import { resultGuide, resultNext } from "./resultGuide";
import { edgeEvidenceOf, signatureOf } from "./runDetails";

const DEFAULT_DEPTH = 2;
const DEFAULT_MAX_NODES = 6;
const MAX_OPEN_DEPTH = 2;
const MAX_OPEN_NODES = 8;
const MAX_IMPACT_DEPTH = 4;
const MAX_IMPACT_NODES = 16;
const MAX_HOPS_PER_NODE = 2;
const MAX_STEPS = 6;

/**
 * Breadth-first trace along the dependency graph. Structural
 * (contains/exports/imports) edges are excluded so the path is real call/type
 * flow; forward walks callees, reverse and impact walk callers. Impact
 * additionally tags each reached node's role so the blast radius on the public
 * surface is legible.
 */
export function runTrace(
  graph: TtscGraphMemory,
  props: ITtscGraphTrace.IRequest,
): ITtscGraphTrace {
  const direction = props.direction ?? "forward";
  const focus = props.focus ?? "all";
  const impact = direction === "impact";
  const maxDepth = bound(
    props.maxDepth,
    DEFAULT_DEPTH,
    1,
    impact ? MAX_IMPACT_DEPTH : MAX_OPEN_DEPTH,
  );
  const maxNodes = bound(
    props.maxNodes,
    DEFAULT_MAX_NODES,
    1,
    impact ? MAX_IMPACT_NODES : MAX_OPEN_NODES,
  );
  const maxHops = maxNodes * MAX_HOPS_PER_NODE;
  const reverse = direction === "reverse" || direction === "impact";
  const includeExternal = props.includeExternal === true;
  // Only an impact trace tags reached nodes with their public-surface role; for
  // forward/reverse the role is noise.
  const withRoles = direction === "impact";

  const start = resolveGraphHandle(graph, props.from);
  if (start.candidates) {
    return {
      type: "trace",
      direction,
      hops: [],
      reached: [],
      truncated: false,
      next: resultNext(
        "clarify",
        "The start handle is ambiguous; choose one returned candidate.",
      ),
      guide: resultGuide(
        "Disambiguate with the returned candidates, or ask the user for the intended symbol.",
      ),
      candidates: start.candidates.map((n) => summary(graph, n)),
    };
  }
  if (start.node === undefined) {
    return {
      type: "trace",
      direction,
      hops: [],
      reached: [],
      truncated: false,
      next: resultNext(
        "clarify",
        "The start handle did not resolve in the compiler graph.",
      ),
      guide: resultGuide(
        "The start symbol was not resolved; answer that the graph has no trace from this handle.",
      ),
    };
  }

  // Path mode: with `to`, return the dependency path from `from` to `to`, the
  // one-call answer for "how does A reach B", instead of an open-ended trace.
  if (props.to !== undefined && props.to !== "") {
    const base = {
      type: "trace" as const,
      direction: "path",
      hops: [],
      reached: [],
      truncated: false,
      next: resultNext(
        "answer",
        "The path result is the structural flow answer; cite path nodes and evidence ranges.",
      ),
      guide: resultGuide(
        "Use the returned path, hops, and evidence ranges as the flow answer.",
      ),
    };
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
      includeExternal,
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
      const edges = orderedEdges(
        graph,
        reverse ? graph.incoming(id) : graph.outgoing(id),
        direction,
        reverse,
      );
      for (const edge of edges) {
        if (!traversable(edge.kind, focus)) continue;
        const otherId = reverse ? edge.from : edge.to;
        const other = graph.node(otherId);
        if (other === undefined || other.kind === "file") continue;
        if (!includeExternal && isExternalNode(other)) continue;
        const hop: ITtscGraphTrace.IHop = {
          from: edge.from,
          to: edge.to,
          kind: edge.kind,
          depth: depth + 1,
        };
        const evidence = edgeEvidenceOf(edge);
        if (evidence !== undefined) hop.evidence = evidence;
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
    type: "trace",
    start: summary(graph, start.node),
    direction,
    hops,
    reached: [...reached.values()],
    steps: traceSteps(graph, hops),
    next: resultNext(
      "answer",
      "Steps, hops, reached nodes, and evidence ranges are the flow answer surface.",
    ),
    guide: resultGuide(
      "Use steps, hops, reached nodes, and evidence ranges as the flow answer or reading-list anchor.",
    ),
    truncated,
  };
}

function traceSteps(
  graph: TtscGraphMemory,
  hops: ITtscGraphTrace.IHop[],
): string[] {
  return hops.slice(0, MAX_STEPS).map((hop) => {
    const from = graph.node(hop.from);
    const to = graph.node(hop.to);
    const lhs = from?.qualifiedName ?? from?.name ?? hop.from;
    const rhs = to?.qualifiedName ?? to?.name ?? hop.to;
    const evidence =
      hop.evidence === undefined
        ? ""
        : ` at ${hop.evidence.file}:${hop.evidence.startLine}`;
    return `${lhs} -[${hop.kind}${evidence}]-> ${rhs}`;
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
  focus: ITtscGraphTrace.IRequest["focus"],
  includeExternal: boolean,
): { path: ITtscGraphNode[]; hops: ITtscGraphTrace.IHop[] } | null {
  const startNode = graph.node(startId);
  if (startNode === undefined) return null;
  if (startId === targetId) return { path: [startNode], hops: [] };
  const parent = new Map<
    string,
    {
      via: string;
      kind: string;
      evidence?: ITtscGraphEvidence;
    }
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
        if (!includeExternal && isExternalNode(other)) continue;
        visited.add(otherId);
        const evidence = edgeEvidenceOf(edge);
        parent.set(otherId, {
          via: id,
          kind: edge.kind,
          evidence,
        });
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

function orderedEdges(
  graph: TtscGraphMemory,
  edges: readonly ITtscGraphEdge[],
  direction: string,
  reverse: boolean,
): readonly ITtscGraphEdge[] {
  if (direction !== "impact")
    return [...edges].sort(
      (a, b) =>
        edgeKindRank(a.kind) - edgeKindRank(b.kind) ||
        traceEndpointRank(graph, reverse ? a.from : a.to) -
          traceEndpointRank(graph, reverse ? b.from : b.to) ||
        evidenceRank(a) - evidenceRank(b),
    );
  return [...edges].sort(
    (a, b) =>
      impactEndpointRank(graph, reverse ? a.from : a.to) -
        impactEndpointRank(graph, reverse ? b.from : b.to) ||
      edgeKindRank(a.kind) - edgeKindRank(b.kind) ||
      evidenceRank(a) - evidenceRank(b),
  );
}

function impactEndpointRank(graph: TtscGraphMemory, id: string): number {
  const node = graph.node(id);
  if (node === undefined) return 9;
  if (isTestPath(node.file)) return 0;
  if (node.exported) return 1;
  if (node.external || node.ignored) return 4;
  return 2;
}

function traceEndpointRank(graph: TtscGraphMemory, id: string): number {
  const node = graph.node(id);
  if (node === undefined) return 9;
  if (isTestPath(node.file)) return 6;
  switch (node.kind) {
    case "function":
    case "method":
    case "class":
      return 0;
    case "variable":
      return 1;
    case "property":
      return 2;
    case "interface":
    case "type":
      return 4;
    default:
      return 3;
  }
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
  if (node.evidence?.startLine !== undefined)
    out.line = node.evidence.startLine;
  const span = node.implementation ?? node.evidence;
  if (span !== undefined) {
    out.sourceSpan = {
      file: span.file,
      startLine: span.startLine,
      ...(span.endLine !== undefined ? { endLine: span.endLine } : {}),
    };
  }
  if (depth !== undefined) out.depth = depth;
  if (withSignature) {
    const sig = signatureOf(graph.project, node);
    if (sig !== undefined) out.signature = sig;
  }
  if (withRoles) {
    const roles: string[] = [];
    if (node.exported) roles.push("exported");
    if (isTestPath(node.file)) roles.push("test");
    if (roles.length > 0) out.roles = roles;
  }
  return out;
}

/** An edge the trace should follow: a real dependency, not a structural edge. */
function traversable(
  kind: string,
  focus: ITtscGraphTrace.IRequest["focus"],
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

function edgeKindRank(kind: string): number {
  switch (kind) {
    case "calls":
      return 0;
    case "instantiates":
      return 1;
    case "renders":
      return 2;
    case "accesses":
      return 3;
    case "tests":
      return 4;
    case "overrides":
    case "decorates":
      return 5;
    case "extends":
    case "implements":
      return 6;
    case "type_ref":
      return 7;
    default:
      return 10;
  }
}

function evidenceRank(edge: ITtscGraphEdge): number {
  const line = edge.evidence?.startLine ?? 9_999;
  const col = edge.evidence?.startCol ?? 999;
  return line * 100 + col;
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
