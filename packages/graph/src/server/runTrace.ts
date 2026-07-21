import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphTrace } from "../structures/ITtscGraphTrace";
import { isDeclarationFile, isExternalNode, isTestPath } from "./pathPolicy";
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
// Path mode walks further than an open trace because it is looking for one
// named end, not building a picture. The cap is the one the request contract
// publishes for path mode.
const MAX_PATH_DEPTH = 12;
const MAX_HOPS_PER_NODE = 2;
const MAX_STEPS = 12;
const DISPATCH_KINDS = new Set<string>(["overrides", "implements"]);
// A declaration whose kind is a type surface never carries a body, and an
// external leaf carries one the graph deliberately does not hold.
const BODYLESS_KINDS = new Set<string>([
  "interface",
  "type",
  "external_symbol",
]);
// `abstract` and `declare` are the two keywords that take the body away from a
// declaration that would otherwise have to have one.
const BODYLESS_MODIFIERS = new Set<string>(["abstract", "declare"]);
// An interface the codebase implements everywhere — a disposable, a listener, a
// lifecycle hook — is not a step in one flow, and naming its implementors is a
// dump of the codebase rather than an answer. Past this many, the declaration
// stays a leaf and `details` answers `implementedBy` for a caller that wants the
// list. The cut is the graph's existing definition of a hub (see
// `isSharedUtility`): across the benchmark corpus it follows 84–100% of dispatch
// sites per project and refuses only the genuinely polymorphic ones (zod's
// 36-way schema interface, VS Code's 533-way disposable).
const DISPATCH_HUB = 12;

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
    const pathDepth = bound(props.maxDepth, MAX_PATH_DEPTH, 1, MAX_PATH_DEPTH);
    const search = findPath(
      graph,
      start.node.id,
      target.node.id,
      pathDepth,
      focus,
      includeExternal,
    );
    const hasPath = search.found !== undefined;
    const path = search.found?.path ?? [];
    const hops = search.found?.hops ?? [];
    // Junctions explain an absence, so they are only computed once absence is
    // established: a walk the depth bound stopped has not established one, and
    // presenting a shared symbol as "the seam" when a direct call path may run
    // past the bound sends the caller to a seam that is not there.
    const junctions =
      hasPath || search.bounded
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
      // A missing path is a fact, not an answer, and the old message called it
      // one: "its path nodes and evidence ranges are what the graph holds
      // between the two ends" — of a result that held nothing. `findPath` says
      // which fact it is; zero hops is instead the valid path from a node to
      // itself. A walk the depth bound stopped establishes nothing at all, so
      // it reports the bound. A walk that ran out of eligible graph did
      // establish an absence, and distinct nodes without a path do not call
      // each other, which in an event-driven codebase is the common case: a
      // pointer handler emits, an emitter's `emit()` runs listeners a
      // registration put in an array, and no call edge crosses that array. The
      // callers of the target are the way across, and the graph has them, so
      // say which call to make instead of handing back an empty result dressed
      // as the answer. Excalidraw's tour spent eleven calls finding this out.
      next: hasPath
        ? pathNext
        : search.bounded
          ? resultNext("inspect", boundedPathReason(pathDepth), "trace")
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
      const { edges: candidates, omitted } = traceEdges(
        graph,
        id,
        reverse,
        focus,
      );
      // A hop the hub bound withheld is omitted whatever the depth budget does
      // next, so the flag is set before the boundary check consumes the step.
      if (
        !truncated &&
        omitted.some(
          (edge) =>
            eligibleTraceEndpoint(
              graph,
              edge,
              reverse,
              focus,
              includeExternal,
            ) !== undefined,
        )
      )
        truncated = true;
      if (depth >= maxDepth) {
        // Reaching the configured boundary does not itself omit data. The
        // response is truncated only when the selected walk has another hop
        // (and, for an unseen endpoint, another node) beyond the boundary.
        if (
          candidates.some(
            (edge) =>
              eligibleTraceEndpoint(
                graph,
                edge,
                reverse,
                focus,
                includeExternal,
              ) !== undefined,
          )
        )
          truncated = true;
        continue;
      }
      const edges = orderedEdges(graph, candidates, direction, reverse);
      for (const edge of edges) {
        const endpoint = eligibleTraceEndpoint(
          graph,
          edge,
          reverse,
          focus,
          includeExternal,
        );
        if (endpoint === undefined) continue;
        const { otherId, other } = endpoint;
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

interface ITraceEndpoint {
  otherId: string;
  other: ITtscGraphNode;
}

/**
 * Candidate edges in the selected direction before focus and node policy,
 * together with the dispatch hops a bound withheld.
 *
 * The two have to travel together. A hub-suppressed fanout used to arrive as an
 * empty dispatch list, which reads exactly like "this declaration dispatches to
 * nothing", and the caller then reported a complete result while eligible hops
 * had been dropped.
 */
function traceEdges(
  graph: TtscGraphMemory,
  id: string,
  reverse: boolean,
  focus: ITtscGraphTrace.IRequest["focus"],
): { edges: readonly ITtscGraphEdge[]; omitted: readonly ITtscGraphEdge[] } {
  const edges = reverse ? graph.incoming(id) : graph.outgoing(id);
  const dispatched = reverse
    ? reverseDispatchEdges(graph, id, focus)
    : dispatchEdges(graph, id, focus);
  // Nothing to add is the common case, and a walk visits the nodes with the
  // largest edge lists, so hand back the stored list rather than a copy of it.
  return {
    edges:
      dispatched.selected.length === 0
        ? edges
        : [...edges, ...dispatched.selected],
    omitted: dispatched.omitted,
  };
}

/** A dispatch fanout split into what the walk follows and what a bound withheld. */
interface IDispatchSelection {
  selected: ITtscGraphEdge[];
  omitted: ITtscGraphEdge[];
}

const NO_DISPATCH: IDispatchSelection = { selected: [], omitted: [] };

/**
 * The endpoint the selected open trace would represent if no result bound
 * stopped it. The depth probe and traversal share this decision so focus,
 * external nodes, file nodes, and direction cannot disagree about omission.
 */
function eligibleTraceEndpoint(
  graph: TtscGraphMemory,
  edge: ITtscGraphEdge,
  reverse: boolean,
  focus: ITtscGraphTrace.IRequest["focus"],
  includeExternal: boolean,
): ITraceEndpoint | undefined {
  if (!traversable(edge.kind, focus)) return undefined;
  const otherId = reverse ? edge.from : edge.to;
  const other = graph.node(otherId);
  if (other === undefined || other.kind === "file") return undefined;
  if (!includeExternal && isExternalNode(other)) return undefined;
  return { otherId, other };
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

/**
 * What to say when the depth bound, not the graph, ended a path search.
 *
 * The caller asked a bounded question and the old answer returned a claim about
 * the whole graph — "they touch nothing in common, so the graph holds no
 * connection between them" — which is the worst thing an index can say wrongly:
 * the caller stops asking and either reads files or concludes the dependency is
 * not there. So report the boundary, and make the continuation one the caller
 * can actually take. At the 12-hop ceiling there is no larger `maxDepth` to
 * retry with, and a message that only invites one would be a dead end of its
 * own; two bounded walks from opposite ends cover twice the distance and are
 * requests the tool already answers.
 */
function boundedPathReason(depth: number): string {
  return (
    `No path was found within the requested depth of ${depth}, but the walk stopped on that bound with eligible graph still ahead of it. ` +
    `This is a boundary, not an absence: the two ends may be connected further out, and nothing here says they are not. ` +
    (depth < MAX_PATH_DEPTH
      ? `Re-run the same path request with a larger \`maxDepth\` (up to ${MAX_PATH_DEPTH}).`
      : `\`maxDepth\` is already at its ${MAX_PATH_DEPTH}-hop maximum, so close the gap from both ends: trace forward from the start, trace the target with \`direction: "reverse"\`, then request the path between a symbol both results name.`)
  );
}

/**
 * What a bounded shortest-path walk learned: the path when it found one, and
 * otherwise whether the walk was stopped by the caller's depth bound or ran the
 * eligible graph out. The two are not the same answer and the caller must not
 * be told the second when only the first happened.
 */
interface IPathSearch {
  /** The shortest eligible path and its hops, when one was found. */
  found?: { path: ITtscGraphNode[]; hops: ITtscGraphTrace.IHop[] };

  /**
   * True when the walk stopped at `maxDepth` with an eligible, unvisited node
   * still ahead of it, so nothing was proven about the two ends.
   */
  bounded: boolean;
}

/**
 * The shortest dependency path from `startId` to `targetId` over real (non-
 * structural) forward edges, breadth-first, within `maxDepth` hops.
 *
 * When no path is found, the walk reports whether the bound stopped it. A
 * boundary is a fact about the request; absence is a fact about the graph, and
 * a search that never reached the far side of its own bound has not established
 * one. Eligibility is the open trace's, so a frontier made only of nodes the
 * selected focus, the external-node policy, a file node, or an earlier visit
 * already excluded is not a frontier and the walk is exhausted.
 */
function findPath(
  graph: TtscGraphMemory,
  startId: string,
  targetId: string,
  maxDepth: number,
  focus: ITtscGraphTrace.IRequest["focus"],
  includeExternal: boolean,
): IPathSearch {
  const startNode = graph.node(startId);
  if (startNode === undefined) return { bounded: false };
  if (startId === targetId)
    return { found: { path: [startNode], hops: [] }, bounded: false };
  const parent = new Map<
    string,
    {
      via: string;
      kind: string;
      evidence?: ITtscGraphEvidence;
    }
  >();
  const visited = new Set<string>([startId]);
  let bounded = false;
  let queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
  while (queue.length > 0) {
    const next: Array<{ id: string; depth: number }> = [];
    for (const { id, depth } of queue) {
      // The forward step the open trace would take, built in one place so the
      // two walks cannot disagree about what a step follows.
      const { edges: candidates } = traceEdges(graph, id, false, focus);
      if (depth >= maxDepth) {
        if (
          candidates.some(
            (edge) =>
              pathEndpoint(graph, edge, focus, includeExternal, visited) !==
              undefined,
          )
        )
          bounded = true;
        continue;
      }
      for (const edge of candidates) {
        const endpoint = pathEndpoint(
          graph,
          edge,
          focus,
          includeExternal,
          visited,
        );
        if (endpoint === undefined) continue;
        const otherId = endpoint.otherId;
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
          return { found: { path, hops }, bounded };
        }
        next.push({ id: otherId, depth: depth + 1 });
      }
    }
    queue = next;
  }
  return { bounded };
}

/**
 * The node a path expansion would represent, or undefined when the selected
 * policy or an earlier visit excludes it. The expansion and the boundary probe
 * share this decision, so what the walk would have followed and what counts as
 * unexplored graph beyond the bound cannot disagree.
 *
 * A path walk is always forward and, unlike the open trace, a node it already
 * reached is not a continuation: the shortest path to it is already known, so a
 * second arrival adds nothing to explore.
 */
function pathEndpoint(
  graph: TtscGraphMemory,
  edge: ITtscGraphEdge,
  focus: ITtscGraphTrace.IRequest["focus"],
  includeExternal: boolean,
  visited: ReadonlySet<string>,
): ITraceEndpoint | undefined {
  const endpoint = eligibleTraceEndpoint(
    graph,
    edge,
    false,
    focus,
    includeExternal,
  );
  if (endpoint === undefined || visited.has(endpoint.otherId)) return undefined;
  return endpoint;
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
    const sig = signatureOf(graph, node);
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

/**
 * The implementations a call that lands here actually runs.
 *
 * A call resolved to an abstract method or an interface member lands on a
 * declaration with no body. A forward walk stops there — and the code that
 * executes is one _incoming_ `overrides`/`implements` edge away, which no
 * forward traversal crosses. NestJS's whole request pipeline sits behind one:
 * `ContextCreator.createContext` calls the abstract `createConcreteContext`,
 * and the guards, pipes and interceptors contexts are its overrides, so the
 * graph said a request reaches an abstract declaration and stops, and the guard
 * it runs was reachable from nothing but its own unit test. Between 1% and 8%
 * of every called symbol in the benchmark projects is such a declaration; every
 * codebase with an abstract base, a strategy, an adapter or a visitor has
 * them.
 *
 * So the walk dispatches: a called declaration with no body continues in the
 * implementations that have one, as a `dispatches` hop cited at the
 * implementation — which is the fact, since the call site named the base and
 * the runtime lands in the override.
 */
function dispatchEdges(
  graph: TtscGraphMemory,
  id: string,
  focus: ITtscGraphTrace.IRequest["focus"],
): IDispatchSelection {
  if (focus === "types") return NO_DISPATCH;
  // The checker relations first: almost no node has one, and reading a
  // declaration's own facts walks its ownership chain, which is work worth
  // doing only where there is something to dispatch to.
  let relations: ITtscGraphEdge[] | undefined;
  for (const edge of graph.incoming(id)) {
    if (DISPATCH_KINDS.has(edge.kind)) (relations ??= []).push(edge);
  }
  if (relations === undefined) return NO_DISPATCH;
  const declaration = graph.node(id);
  if (declaration === undefined || hasDeclarationBody(graph, declaration))
    return NO_DISPATCH;
  const out: ITtscGraphEdge[] = [];
  // Per implementation, not per relation. A class may name one base in two
  // heritage clauses — `class Impl extends Base implements Base` is legal — and
  // the producer records the member pair once per clause, as `overrides` and as
  // `implements`. That is one implementation and one crossing: emitting it
  // twice would repeat the hop and count the same class twice against the hub
  // cut.
  const dispatched = new Set<string>();
  for (const edge of relations) {
    if (dispatched.has(edge.from)) continue;
    const implementation = graph.node(edge.from);
    if (
      implementation === undefined ||
      !hasDeclarationBody(graph, implementation)
    )
      continue;
    dispatched.add(edge.from);
    out.push({
      from: id,
      to: edge.from,
      kind: "dispatches",
      ...(edge.evidence !== undefined ? { evidence: edge.evidence } : {}),
    });
  }
  // Above the hub cut the fanout stops being a trace and starts being a
  // listing, so the walk does not follow it — but the hops are real and their
  // absence is an omission the caller has to be able to report.
  return out.length >= DISPATCH_HUB
    ? { selected: [], omitted: out }
    : { selected: out, omitted: [] };
}

/**
 * The declaration a change to this implementation is a change to.
 *
 * `dispatches` is one fact and both directions have to see it. Forward, a call
 * that lands on a bodyless declaration continues in the implementation that
 * runs; reverse, a change to that implementation is a change every caller of
 * the declaration feels — and `impact` is the query an agent runs _before_
 * editing a method. The checker relation is oriented implementation-to-base, so
 * from the implementation it is an outgoing edge and a reverse walk, which only
 * reads incoming edges, never sees it. Both halves of the path are one step
 * away in a direction the traversal does not take.
 *
 * The synthetic edge is the forward one, unchanged, so eligibility, checker
 * validity, and the hub cut cannot drift apart between the two directions: ask
 * the base what it dispatches to, and keep the edges that land here.
 */
function reverseDispatchEdges(
  graph: TtscGraphMemory,
  id: string,
  focus: ITtscGraphTrace.IRequest["focus"],
): IDispatchSelection {
  if (focus === "types") return NO_DISPATCH;
  const selected: ITtscGraphEdge[] = [];
  const omitted: ITtscGraphEdge[] = [];
  const bases = new Set<string>();
  for (const edge of graph.outgoing(id)) {
    if (!DISPATCH_KINDS.has(edge.kind) || bases.has(edge.to)) continue;
    bases.add(edge.to);
    const fanout = dispatchEdges(graph, edge.to, focus);
    for (const dispatch of fanout.selected)
      if (dispatch.to === id) selected.push(dispatch);
    // The base's fanout is bounded as a whole, so a reverse walk that lands on
    // a suppressed sibling has the same omission to report as the forward one.
    for (const dispatch of fanout.omitted)
      if (dispatch.to === id) omitted.push(dispatch);
  }
  return { selected, omitted };
}

/**
 * Whether the declaration this node stands for has a body of its own.
 *
 * Having a body and naming a modeled dependency are different facts. Counting
 * outgoing `calls`/`accesses`/`instantiates`/`renders` edges measures the
 * second and answers as though it were the first, and it is wrong in both
 * directions: an implementation whose body returns a literal, throws, or only
 * moves locals around has degree zero and was refused as a dispatch target,
 * while a concrete base method was promoted through its own override the moment
 * its body stopped naming anything the graph models. Two graphs identical in
 * every declaration fact then answered differently because of one statement
 * inside a body.
 *
 * So read the declaration instead. A type surface has no body; `abstract` and
 * `declare` take it away; an interface member and anything inside an ambient
 * container never had one; a `.d.ts` declaration is ambient whether or not the
 * keyword is written; and an external leaf has a body the graph deliberately
 * does not hold. Everything else is a concrete declaration, which is a real
 * destination and is never promoted through an override, whatever it calls.
 */
function hasDeclarationBody(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): boolean {
  if (BODYLESS_KINDS.has(node.kind)) return false;
  if (isExternalNode(node)) return false;
  if (isDeclarationFile(node.file)) return false;
  if (hasBodylessModifier(node)) return false;
  return !inBodylessContainer(graph, node);
}

function hasBodylessModifier(node: ITtscGraphNode): boolean {
  return node.modifiers?.some((m) => BODYLESS_MODIFIERS.has(m)) === true;
}

/**
 * Whether an owner up the `contains` tree makes this declaration bodyless: an
 * interface, or an ambient container. A member writes no keyword of its own —
 * `declare` on a class or namespace is not repeated on what it holds — so the
 * fact lives on the owner and the walk has to go get it.
 */
function inBodylessContainer(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): boolean {
  const seen = new Set<string>([node.id]);
  let current: ITtscGraphNode | undefined = node;
  while (current !== undefined) {
    const container: ITtscGraphNode | undefined = containerOf(graph, current);
    if (container === undefined || container.kind === "file") return false;
    if (seen.has(container.id)) return false;
    seen.add(container.id);
    if (container.kind === "interface" || hasBodylessModifier(container))
      return true;
    current = container;
  }
  return false;
}

/** The declaration that owns this one, through the synthesized ownership tree. */
function containerOf(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): ITtscGraphNode | undefined {
  for (const edge of graph.incoming(node.id))
    if (edge.kind === "contains") return graph.node(edge.from);
  return undefined;
}

/** An edge the trace should follow: a real dependency, not a structural edge. */
function traversable(
  kind: string,
  focus: ITtscGraphTrace.IRequest["focus"],
): boolean {
  if (kind === "contains" || kind === "exports" || kind === "imports") {
    return false;
  }
  if (kind === "dispatches") return focus !== "types";
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
    // Where a call landed on a declaration, the implementation it dispatches to
    // is the continuation of that call, not an afterthought behind the
    // declaration's type references.
    case "dispatches":
      return 1;
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
