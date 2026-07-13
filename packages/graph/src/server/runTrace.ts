import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphTrace } from "../structures/ITtscGraphTrace";
import { isExternalNode, isTestPath } from "./pathPolicy";
import { resolveGraphHandle } from "./resolveHandle";
import { IRunnerOutput, resultNext } from "./resultNext";
import { edgeEvidenceOf, signatureOf } from "./runDetails";

const DEFAULT_DEPTH = 3;
const DEFAULT_MAX_NODES = 12;
// An open trace used to stop at two hops and eight nodes, whatever depth the
// caller asked for. A question that spans a runtime chain — a state change
// through tracking, scheduling, rendering, then patching — is that chain hop by
// hop, so the model re-issued a trace per hop and paid a round trip for each: a
// single vue question spent twenty-six calls walking a flow the graph could have
// walked once. The cap now follows the chain instead of cutting it.
const MAX_OPEN_DEPTH = 8;
const MAX_OPEN_NODES = 32;
const MAX_IMPACT_DEPTH = 4;
const MAX_IMPACT_NODES = 16;
const MAX_HOPS_PER_NODE = 2;
const MAX_STEPS = 12;

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
): IRunnerOutput<ITtscGraphTrace> {
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
      result: {
        type: "trace",
        direction,
        hops: [],
        reached: [],
        truncated: false,
        candidates: start.candidates.map((n) => summary(graph, n)),
      },
      next: resultNext(
        "clarify",
        "The start handle is ambiguous: it matched several candidates, one of which names the trace.",
      ),
    };
  }
  if (start.node === undefined) {
    return {
      result: {
        type: "trace",
        direction,
        hops: [],
        reached: [],
        truncated: false,
      },
      next: resultNext(
        "outside",
        "The start handle did not resolve in the graph, so it holds no trace from this handle.",
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
    };
    const pathNext = resultNext(
      "answer",
      "The path result is the structural flow: its path nodes and evidence ranges are what the graph holds between the two ends.",
    );
    const target = resolveGraphHandle(graph, props.to);
    if (target.candidates) {
      return {
        result: {
          ...base,
          start: summary(graph, start.node),
          candidates: target.candidates.map((n) => summary(graph, n)),
        },
        next: resultNext(
          "inspect",
          "The target names several nodes; re-trace with the id of the one the question means.",
          "trace",
        ),
      };
    }
    if (target.node === undefined) {
      return {
        result: { ...base, start: summary(graph, start.node) },
        next: resultNext(
          "outside",
          "The target resolved to no node, so the graph holds no path to it.",
        ),
      };
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
    const junctions =
      hops.length > 0
        ? []
        : junctionsBetween(graph, start.node.id, target.node.id, focus);
    return {
      result: {
        ...base,
        start: summary(graph, start.node),
        target: summary(graph, target.node),
        hops,
        path: path.map((node, i) => summary(graph, node, i, false, true)),
        steps: traceSteps(graph, hops),
        ...(junctions.length > 0 ? { junctions } : {}),
      },
      // An empty path is a fact, not an answer, and the old message called it
      // one: "its path nodes and evidence ranges are what the graph holds
      // between the two ends" — of a result that held nothing. The two ends do
      // not call each other, which in an event-driven codebase is the common
      // case: a pointer handler emits, an emitter's `emit()` runs listeners a
      // registration put in an array, and no call edge crosses that array. The
      // callers of the target are the way across, and the graph has them, so
      // say which call to make instead of handing back an empty result dressed
      // as the answer. Excalidraw's tour spent eleven calls finding this out.
      next:
        hops.length > 0
          ? pathNext
          : junctions.length > 0
            ? resultNext(
                "inspect",
                "No call path runs between the two ends — a callback stands between them (an event emitter, a subscription, a lifecycle hook), and no call edge crosses one. `junctions` names the symbols both ends touch, which is the seam: trace the junction to see who registers on it and who fires it.",
                "trace",
              )
            : resultNext(
                "outside",
                "No call path runs from the start to the target and they touch nothing in common, so the graph holds no connection between them.",
              ),
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
    result: {
      type: "trace",
      start: summary(graph, start.node),
      direction,
      hops,
      reached: [...reached.values()],
      steps: traceSteps(graph, hops),
      truncated,
    },
    next: resultNext(
      "answer",
      "Steps, hops, reached nodes, and evidence ranges are the flow the graph holds from this start.",
    ),
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
/**
 * The symbols both ends of an unreachable path touch.
 *
 * A call graph cannot cross a callback: the registration hands a listener to an
 * emitter, and `emit()` runs whatever the registration put in an array. But the
 * registration and the emit both reference the emitter, and those are edges the
 * checker resolved — Excalidraw's `App.componentDidMount` and its
 * `Store.emitDurableIncrement` both touch `Store.onDurableIncrementEmitter`,
 * which is the exact seam the path walk stops at.
 *
 * So when the path is empty, name what the two ends share. It is not a path and
 * the result says so; it is the symbol to inspect next, with the two edges that
 * make it the seam. Nothing here is matched or inferred: a junction is an edge
 * from each end to the same node.
 */
function junctionsBetween(
  graph: TtscGraphMemory,
  startId: string,
  targetId: string,
  focus: ITtscGraphTrace.IRequest["focus"],
): ITtscGraphTrace.IJunction[] {
  const startTouches = touchedBy(graph, startId, focus);
  const targetTouches = touchedBy(graph, targetId, focus);
  const out: ITtscGraphTrace.IJunction[] = [];
  for (const [id, fromStart] of startTouches) {
    const fromTarget = targetTouches.get(id);
    if (fromTarget === undefined) continue;
    const node = graph.node(id);
    if (node === undefined || node.kind === "file" || isExternalNode(node))
      continue;
    out.push({
      id: node.id,
      name: node.qualifiedName ?? node.name,
      kind: node.kind,
      file: node.file,
      ...(node.evidence?.startLine !== undefined
        ? { line: node.evidence.startLine }
        : {}),
      fromStart,
      fromTarget,
    });
  }
  // A shared leaf helper is noise; a shared emitter, store, or registry is the
  // seam. What both ends hold onto rather than merely call is the thing standing
  // between them, so state comes first.
  out.sort((a, b) => junctionRank(b) - junctionRank(a));
  return out.slice(0, MAX_JUNCTIONS);
}

const MAX_JUNCTIONS = 4;

/** How much a shared symbol looks like a seam rather than a shared utility. */
function junctionRank(junction: ITtscGraphTrace.IJunction): number {
  let rank = 0;
  if (junction.kind === "variable" || junction.kind === "property") rank += 3;
  if (junction.fromStart.kind === "accesses") rank += 2;
  if (junction.fromTarget.kind === "accesses") rank += 2;
  return rank;
}

/** Every node an end touches, with the edge that touches it. */
function touchedBy(
  graph: TtscGraphMemory,
  id: string,
  focus: ITtscGraphTrace.IRequest["focus"],
): Map<string, ITtscGraphTrace.IJunctionEdge> {
  const touched = new Map<string, ITtscGraphTrace.IJunctionEdge>();
  for (const edge of graph.outgoing(id)) {
    if (!traversable(edge.kind, focus)) continue;
    if (!touched.has(edge.to))
      touched.set(edge.to, {
        kind: edge.kind,
        outgoing: true,
        ...(edge.evidence !== undefined ? { evidence: edge.evidence } : {}),
      });
  }
  for (const edge of graph.incoming(id)) {
    if (!traversable(edge.kind, focus)) continue;
    if (!touched.has(edge.from))
      touched.set(edge.from, {
        kind: edge.kind,
        outgoing: false,
        ...(edge.evidence !== undefined ? { evidence: edge.evidence } : {}),
      });
  }
  return touched;
}

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
