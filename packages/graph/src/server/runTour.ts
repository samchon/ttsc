import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphDetails } from "../structures/ITtscGraphDetails";
import { ITtscGraphEntrypoints } from "../structures/ITtscGraphEntrypoints";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { ITtscGraphTour } from "../structures/ITtscGraphTour";
import { ITtscGraphTrace } from "../structures/ITtscGraphTrace";
import { resultGuide, resultNext } from "./resultGuide";
import { decoratorsOf, runDetails, signatureOf } from "./runDetails";
import { runEntrypoints } from "./runEntrypoints";
import { runTrace } from "./runTrace";

const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 5;
const FLOW_SEEDS = 2;
const DETAIL_SEEDS = 3;
const TEST_SEEDS = 3;
const MAX_FLOW_ANCHORS = 8;
const MAX_NEARBY = 10;
const MAX_TESTS = 8;
const MAX_READ_NEXT = 14;
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);
const EXECUTION_KINDS = new Set<string>([
  "calls",
  "instantiates",
  "accesses",
  "renders",
]);
const TOUR_SEED_KINDS = new Set<string>([
  "class",
  "function",
  "method",
  "variable",
  "module",
  "namespace",
  "enum",
]);
const QUERY_STOP_WORDS = new Set<string>([
  "api",
  "architecture",
  "behavior",
  "central",
  "code",
  "flow",
  "implementation",
  "next",
  "project",
  "public",
  "read",
  "runtime",
  "test",
  "tests",
  "tour",
  "typescript",
  "work",
]);

/**
 * Compose an onboarding/code-tour answer surface from existing graph
 * operations. It returns selected symbols, flows, nearby edges, test anchors,
 * and read-next anchors without reading or embedding source bodies.
 */
export function runTour(
  graph: TtscGraphMemory,
  props: ITtscGraphTour.IRequest,
): ITtscGraphTour {
  const query = props.query.trim();
  const limit = bound(props.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const entry = runEntrypoints(graph, {
    type: "entrypoints",
    query,
    limit,
    neighbors: 1,
  });
  const seeds = tourSeedsOf(graph, entry, query, limit);
  const seedIds = seeds.map((node) => node.id);
  const entrypoints = seeds.map((node) => graphNodeOf(graph, node));

  const primaryFlow: ITtscGraphTour.IFlow[] = [];
  for (const id of seedIds.slice(0, FLOW_SEEDS)) {
    const trace = runTrace(graph, {
      type: "trace",
      from: id,
      direction: "forward",
      focus: "execution",
      maxDepth: 2,
      maxNodes: 8,
    });
    const start = trace.start;
    if (start === undefined) continue;
    const hops = trace.hops.filter((hop) => isTourHop(graph, hop));
    const reached = trace.reached.filter(isTourTraceNode);
    primaryFlow.push({
      start: traceNodeOf(start),
      steps: hops
        .slice(0, MAX_FLOW_ANCHORS)
        .map((hop) => flowStepOf(graph, hop)),
      reached: reached.map(traceNodeOf),
      anchors: flowAnchorsOf(trace, hops, reached).slice(0, MAX_FLOW_ANCHORS),
      ...(trace.truncated ? { truncated: true } : {}),
    });
  }

  const details =
    seedIds.length === 0
      ? undefined
      : runDetails(graph, {
          type: "details",
          handles: seedIds.slice(0, DETAIL_SEEDS),
          neighbors: true,
          memberLimit: 4,
          dependencyLimit: 2,
          neighborLimit: 2,
        });
  const nearby = details === undefined ? [] : nearbyAnchorsOf(details);

  const tests =
    props.includeTests === false
      ? []
      : testAnchorsOf(graph, seedIds.slice(0, TEST_SEEDS));
  const readNext = uniqueAnchors([
    ...entrypoints.flatMap((node) =>
      anchorFromNode("central entrypoint", node),
    ),
    ...primaryFlow.flatMap((flow) => flow.anchors),
    ...nearby,
    ...tests,
  ]).slice(0, MAX_READ_NEXT);

  return {
    type: "tour",
    query,
    entrypoints,
    primaryFlow,
    nearby: nearby.slice(0, MAX_NEARBY),
    tests: tests.slice(0, MAX_TESTS),
    readNext,
    next: resultNext(
      "answer",
      "This tour already selects central entrypoints, primary flow, nearby paths, tests, and read-next anchors.",
    ),
    guide: resultGuide(
      "Use this tour as the answer-ready index: central entrypoints, flow steps, nearby paths, tests, and reading anchors are already selected.",
    ),
    ...(entry.truncated ||
    primaryFlow.some((flow) => flow.truncated === true) ||
    nearby.length > MAX_NEARBY ||
    tests.length > MAX_TESTS
      ? { truncated: true }
      : {}),
  };
}

function tourSeedsOf(
  graph: TtscGraphMemory,
  entry: ITtscGraphEntrypoints,
  query: string,
  limit: number,
): ITtscGraphNode[] {
  const out: ITtscGraphNode[] = [];
  const seen = new Set<string>();
  const add = (node: ITtscGraphNode | undefined): void => {
    if (node === undefined || seen.has(node.id) || !isTourSeed(node)) return;
    seen.add(node.id);
    out.push(node);
  };
  for (const mention of entry.mentions) {
    add(mention.node === undefined ? undefined : graph.node(mention.node.id));
  }
  if (isSpecificQuery(query)) {
    for (const hit of entry.hits) add(graph.node(hit.id));
  }
  for (const node of rankedTourSeeds(graph, query)) add(node);
  if (out.length === 0) {
    for (const hit of entry.hits) add(graph.node(hit.id));
  }
  return out.slice(0, limit);
}

function graphNodeOf(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): ITtscGraphTour.INode {
  const span = node.implementation ?? node.evidence;
  const signature = signatureOf(graph.project, node);
  const decorators = decoratorsOf(node);
  return {
    id: node.id,
    name: node.qualifiedName ?? node.name,
    kind: node.kind,
    file: node.file,
    ...(node.evidence?.startLine !== undefined
      ? { line: node.evidence.startLine }
      : {}),
    ...(span !== undefined
      ? {
          sourceSpan: {
            file: span.file,
            startLine: span.startLine,
            ...(span.endLine !== undefined ? { endLine: span.endLine } : {}),
          },
        }
      : {}),
    ...(signature !== undefined ? { signature } : {}),
    ...(decorators !== undefined ? { decorators } : {}),
  };
}

function traceNodeOf(node: ITtscGraphTrace.INode): ITtscGraphTour.INode {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    file: node.file,
    ...(node.line !== undefined ? { line: node.line } : {}),
    ...(node.sourceSpan !== undefined
      ? {
          sourceSpan: {
            file: node.sourceSpan.file,
            startLine: node.sourceSpan.startLine,
            ...(node.sourceSpan.endLine !== undefined
              ? { endLine: node.sourceSpan.endLine }
              : {}),
          },
        }
      : {}),
    ...(node.signature !== undefined ? { signature: node.signature } : {}),
  };
}

function flowAnchorsOf(
  trace: ITtscGraphTrace,
  hops: ITtscGraphTrace.IHop[],
  reached: ITtscGraphTrace.INode[],
): ITtscGraphTour.IAnchor[] {
  return uniqueAnchors([
    ...anchorFromNode("flow start", trace.start),
    ...reached.flatMap((node) => anchorFromNode("flow node", node)),
    ...hops.flatMap((hop) =>
      anchorFromEvidence("flow edge", `${hop.from} -> ${hop.to}`, hop.evidence),
    ),
  ]);
}

function rankedTourSeeds(
  graph: TtscGraphMemory,
  query: string,
): ITtscGraphNode[] {
  const terms = subwords(query).filter(
    (term) => term.length > 2 && !QUERY_STOP_WORDS.has(term),
  );
  return graph.nodes
    .filter(isTourSeed)
    .map((node) => ({
      node,
      score: tourSeedScore(graph, node, terms),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.node);
}

function tourSeedScore(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  terms: string[],
): number {
  const degree = realDegree(graph, node.id);
  const execution = executionDegree(graph, node.id);
  let score = kindScore(node.kind);
  score += entrySurfaceScore(node);
  score += Math.min(14, Math.log2(1 + degree.in) * 4);
  score += Math.min(30, Math.log2(1 + degree.out) * 9);
  score += Math.min(28, Math.log2(1 + execution.out) * 10);
  if (node.exported) score += 14;
  if (node.decorators !== undefined && node.decorators.length > 0) score += 10;
  score += queryMatchScore(node, terms);
  return score;
}

function isTourSeed(node: ITtscGraphNode): boolean {
  return (
    TOUR_SEED_KINDS.has(node.kind) &&
    !node.external &&
    !node.ignored &&
    node.evidence !== undefined &&
    !isNoisePath(node.file)
  );
}

function isTourTraceNode(node: ITtscGraphTrace.INode): boolean {
  return !isNoisePath(node.file);
}

function isTourHop(graph: TtscGraphMemory, hop: ITtscGraphTrace.IHop): boolean {
  const from = graph.node(hop.from);
  const to = graph.node(hop.to);
  return (
    from !== undefined &&
    to !== undefined &&
    !STRUCTURAL_KINDS.has(hop.kind) &&
    !isNoisePath(from.file) &&
    !isNoisePath(to.file)
  );
}

function flowStepOf(graph: TtscGraphMemory, hop: ITtscGraphTrace.IHop): string {
  const from = graph.node(hop.from);
  const to = graph.node(hop.to);
  const lhs = from?.qualifiedName ?? from?.name ?? hop.from;
  const rhs = to?.qualifiedName ?? to?.name ?? hop.to;
  const evidence = hop.evidence;
  const at =
    evidence === undefined ? "" : ` at ${evidence.file}:${evidence.startLine}`;
  return `${lhs} -[${hop.kind}${at}]-> ${rhs}`;
}

function realDegree(
  graph: TtscGraphMemory,
  id: string,
): {
  in: number;
  out: number;
} {
  let incoming = 0;
  let outgoing = 0;
  for (const edge of graph.outgoing(id))
    if (!STRUCTURAL_KINDS.has(edge.kind)) outgoing++;
  for (const edge of graph.incoming(id))
    if (!STRUCTURAL_KINDS.has(edge.kind)) incoming++;
  return { in: incoming, out: outgoing };
}

function executionDegree(
  graph: TtscGraphMemory,
  id: string,
): {
  in: number;
  out: number;
} {
  let incoming = 0;
  let outgoing = 0;
  for (const edge of graph.outgoing(id))
    if (EXECUTION_KINDS.has(edge.kind)) outgoing++;
  for (const edge of graph.incoming(id))
    if (EXECUTION_KINDS.has(edge.kind)) incoming++;
  return { in: incoming, out: outgoing };
}

function kindScore(kind: string): number {
  switch (kind) {
    case "function":
    case "method":
      return 28;
    case "class":
      return 24;
    case "module":
    case "namespace":
      return 16;
    case "enum":
      return 10;
    case "variable":
      return 8;
    default:
      return 0;
  }
}

function entrySurfaceScore(node: ITtscGraphNode): number {
  const file = node.file.replace(/\\/g, "/");
  const base = file.slice(file.lastIndexOf("/") + 1).toLowerCase();
  const stem = base.replace(/\.[cm]?[tj]sx?$/, "");
  let score = 0;
  if (stem === "index") score += 48;
  else if (stem === "main" || stem === "server" || stem === "bootstrap")
    score += 42;
  else if (stem === "app" || stem === "application") score += 28;

  const depth = sourceDepth(file);
  if (depth <= 1) score += 22;
  else if (depth === 2) score += 12;
  else if (depth === 3) score += 5;

  if (node.exported && score > 0) score += 12;
  return score;
}

function sourceDepth(file: string): number {
  const parts = file.split("/").filter(Boolean);
  if (parts[0] === "src") return Math.max(0, parts.length - 2);
  if (parts[0] === "packages" && parts.length >= 3) {
    return Math.max(0, parts.length - 4);
  }
  return Math.max(0, parts.length - 1);
}

function queryMatchScore(node: ITtscGraphNode, terms: string[]): number {
  if (terms.length === 0) return 0;
  const words = new Set([
    ...subwords(node.name),
    ...subwords(node.qualifiedName ?? ""),
    ...subwords(node.file),
  ]);
  let score = 0;
  for (const term of terms) if (words.has(term)) score += 3;
  return score;
}

function isSpecificQuery(query: string): boolean {
  return (
    /`[^`]+`/.test(query) ||
    /\b[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\b/.test(query) ||
    /\b[A-Z][A-Za-z0-9_$]{2,}\b/.test(query) ||
    /[a-z][A-Z]/.test(query)
  );
}

function isNoisePath(file: string): boolean {
  return (
    file === "" ||
    file.startsWith("bundled://") ||
    /(^|\/)node_modules\//.test(file) ||
    /(^|\/)(test|tests|__tests__|spec|sample|samples)\//.test(file) ||
    /\.(test|spec)\.[cm]?tsx?$/.test(file) ||
    /\.d\.[cm]?ts$/.test(file) ||
    /(^|\/)(dist|build|coverage|generated|__generated__)\//.test(file)
  );
}

function subwords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

function nearbyAnchorsOf(details: ITtscGraphDetails): ITtscGraphTour.IAnchor[] {
  const anchors: ITtscGraphTour.IAnchor[] = [];
  for (const node of details.nodes) {
    anchors.push(...anchorFromNode("selected symbol", detailNodeOf(node)));
    for (const ref of [
      ...(node.calls ?? []),
      ...(node.types ?? []),
      ...(node.dependsOn ?? []),
      ...(node.dependedOnBy ?? []),
    ]) {
      anchors.push(
        ...anchorFromEvidence(
          `${ref.relation} ${ref.name}`,
          ref.name,
          ref.evidence,
        ),
      );
    }
  }
  return uniqueAnchors(anchors);
}

function detailNodeOf(node: ITtscGraphDetails.INode): ITtscGraphTour.INode {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    file: node.file,
    ...(node.line !== undefined ? { line: node.line } : {}),
    ...(node.sourceSpan !== undefined
      ? {
          sourceSpan: {
            file: node.sourceSpan.file,
            startLine: node.sourceSpan.startLine,
            ...(node.sourceSpan.endLine !== undefined
              ? { endLine: node.sourceSpan.endLine }
              : {}),
          },
        }
      : {}),
    ...(node.signature !== undefined ? { signature: node.signature } : {}),
    ...(node.decorators !== undefined ? { decorators: node.decorators } : {}),
  };
}

function testAnchorsOf(
  graph: TtscGraphMemory,
  seedIds: string[],
): ITtscGraphTour.IAnchor[] {
  const anchors: ITtscGraphTour.IAnchor[] = [];
  for (const id of seedIds) {
    const impact = runTrace(graph, {
      type: "trace",
      from: id,
      direction: "impact",
      maxDepth: 4,
      maxNodes: 16,
    });
    for (const node of impact.reached) {
      if (node.roles?.includes("test")) {
        anchors.push(...anchorFromNode("test coverage", node));
      }
    }
  }
  return uniqueAnchors(anchors);
}

function anchorFromNode(
  reason: string,
  node: ITtscGraphTour.INode | ITtscGraphTrace.INode | undefined,
): ITtscGraphTour.IAnchor[] {
  if (node === undefined) return [];
  const span =
    "sourceSpan" in node && node.sourceSpan !== undefined
      ? node.sourceSpan
      : node.line !== undefined
        ? { file: node.file, startLine: node.line }
        : undefined;
  if (span === undefined) return [];
  return [
    {
      reason,
      id: node.id,
      name: node.name,
      kind: node.kind,
      file: span.file,
      startLine: span.startLine,
      ...(span.endLine !== undefined ? { endLine: span.endLine } : {}),
    },
  ];
}

function anchorFromEvidence(
  reason: string,
  name: string,
  evidence: ITtscGraphEvidence | undefined,
): ITtscGraphTour.IAnchor[] {
  if (evidence === undefined) return [];
  return [
    {
      reason,
      name,
      file: evidence.file,
      startLine: evidence.startLine,
      ...(evidence.endLine !== undefined ? { endLine: evidence.endLine } : {}),
    },
  ];
}

function uniqueAnchors(
  anchors: ITtscGraphTour.IAnchor[],
): ITtscGraphTour.IAnchor[] {
  const out: ITtscGraphTour.IAnchor[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors) {
    const key = `${anchor.file}:${anchor.startLine}:${anchor.name}:${anchor.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(anchor);
  }
  return out;
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
