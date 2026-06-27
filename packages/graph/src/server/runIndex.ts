import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphIndex } from "../structures/ITtscGraphIndex";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { resolveGraphHandle } from "./resolveHandle";
import { decoratorsOf, edgeEvidenceOf, signatureOf } from "./runExpand";
import { runQuery } from "./runQuery";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const DEFAULT_NEIGHBORS = 1;
const MAX_NEIGHBORS = 4;
const MAX_SEEDS = 3;
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);

/**
 * Build the first source-free index for a code question. The result gives the
 * model stable handles, declaration signatures, and direct graph context. It is
 * deliberately not a source reader; source remains opt-in through
 * symbol_details.
 */
export function runIndex(
  graph: TtscGraphMemory,
  props: ITtscGraphIndex.IProps,
): ITtscGraphIndex {
  const query = props.query.trim();
  const limit = bound(props.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const neighborLimit = bound(
    props.neighbors,
    DEFAULT_NEIGHBORS,
    0,
    MAX_NEIGHBORS,
  );

  const queryResult = runQuery(graph, { query, limit });
  const hits = queryResult.hits.map((hit) => ({ ...hit }));

  const mentions = directMentions(graph, query).map((handle) => {
    const resolved = resolveGraphHandle(graph, handle, 6);
    const mention: ITtscGraphIndex.IMention = { handle };
    if (resolved.node !== undefined)
      mention.node = nodeOf(graph, resolved.node);
    if (resolved.candidates !== undefined) {
      mention.candidates = resolved.candidates.map((node) =>
        nodeOf(graph, node),
      );
    }
    return mention;
  });

  const seeds: ITtscGraphNode[] = [];
  const seen = new Set<string>();
  const addSeed = (node: ITtscGraphNode | undefined): void => {
    if (node === undefined || seen.has(node.id)) return;
    seen.add(node.id);
    seeds.push(node);
  };
  for (const mention of mentions) {
    if (mention.node !== undefined) addSeed(graph.node(mention.node.id));
  }
  for (const hit of hits) addSeed(graph.node(hit.id));

  let truncated = seeds.length > MAX_SEEDS;
  const neighborhood: ITtscGraphIndex.INeighborhood[] = [];
  for (const seed of seeds.slice(0, MAX_SEEDS)) {
    const outgoing = refs(graph, graph.outgoing(seed.id), "to", neighborLimit);
    const incoming = refs(
      graph,
      graph.incoming(seed.id),
      "from",
      neighborLimit,
    );
    if (outgoing.truncated || incoming.truncated) truncated = true;
    neighborhood.push({
      ...nodeOf(graph, seed),
      dependsOn: outgoing.items,
      dependedOnBy: incoming.items,
    });
  }

  return {
    query,
    hits,
    mentions,
    neighborhood,
    next: {
      expand: seeds.slice(0, MAX_SEEDS).map((node) => node.id),
      traceFrom: seeds.slice(0, MAX_SEEDS).map((node) => node.id),
    },
    ...(truncated ? { truncated: true } : {}),
  };
}

function nodeOf(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): ITtscGraphIndex.INode {
  const out: ITtscGraphIndex.INode = {
    id: node.id,
    name: node.qualifiedName ?? node.name,
    kind: node.kind,
    file: node.file,
  };
  if (node.evidence?.startLine !== undefined)
    out.line = node.evidence.startLine;
  const signature = signatureOf(graph.project, node);
  if (signature !== undefined) out.signature = signature;
  const decorators = decoratorsOf(node);
  if (decorators !== undefined) out.decorators = decorators;
  return out;
}

function refOf(
  node: ITtscGraphNode,
  edge: ITtscGraphEdge,
): ITtscGraphIndex.IReference {
  const out: ITtscGraphIndex.IReference = {
    id: node.id,
    name: node.qualifiedName ?? node.name,
    kind: node.kind,
    file: node.file,
    relation: edge.kind,
  };
  if (node.evidence?.startLine !== undefined)
    out.line = node.evidence.startLine;
  const evidence = edgeEvidenceOf(edge);
  if (evidence !== undefined) out.evidence = evidence;
  return out;
}

function refs(
  graph: TtscGraphMemory,
  edges: readonly ITtscGraphEdge[],
  end: "to" | "from",
  limit: number,
): { items: ITtscGraphIndex.IReference[]; truncated: boolean } {
  const ranked: Array<{ ref: ITtscGraphIndex.IReference; rank: number }> = [];
  const seen = new Set<string>();
  let available = 0;
  for (const edge of edges) {
    if (STRUCTURAL_KINDS.has(edge.kind)) continue;
    const other = graph.node(end === "to" ? edge.to : edge.from);
    if (other === undefined || other.kind === "file") continue;
    const key = `${edge.kind}:${other.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    available++;
    const ref = refOf(other, edge);
    ranked.push({ ref, rank: refRank(ref, edge) });
  }
  ranked.sort((a, b) => a.rank - b.rank);
  const items: ITtscGraphIndex.IReference[] = [];
  for (const item of ranked) {
    if (items.length < limit) items.push(item.ref);
  }
  return { items, truncated: available > items.length };
}

function refRank(
  ref: ITtscGraphIndex.IReference,
  edge: ITtscGraphEdge,
): number {
  return (
    edgeKindRank(edge.kind) * 100_000 +
    evidenceRank(edge) +
    (ref.file.startsWith("bundled://") ? 20_000 : 0)
  );
}

function evidenceRank(edge: ITtscGraphEdge): number {
  const line = edge.evidence?.startLine ?? 9_999;
  const col = edge.evidence?.startCol ?? 999;
  return line * 100 + col;
}

function edgeKindRank(kind: string): number {
  switch (kind) {
    case "calls":
      return 0;
    case "instantiates":
      return 1;
    case "accesses":
    case "renders":
      return 2;
    case "tests":
      return 3;
    case "overrides":
    case "decorates":
      return 4;
    case "extends":
    case "implements":
      return 5;
    case "type_ref":
      return 6;
    default:
      return 10;
  }
}

function directMentions(graph: TtscGraphMemory, query: string): string[] {
  const handles = new Set<string>();
  for (const token of query.split(/\s+/)) {
    const handle = normalizeNodeIdToken(token);
    if (handle !== undefined && graph.node(handle) !== undefined) {
      handles.add(handle);
    }
  }
  for (const match of query.matchAll(/`([^`]+)`/g)) {
    const raw = match[1] ?? "";
    const id = normalizeNodeIdToken(raw);
    if (id !== undefined && graph.node(id) !== undefined) {
      handles.add(id);
      continue;
    }
    const handle = normalizeHandle(raw);
    if (handle !== undefined) handles.add(handle);
  }
  for (const match of query.matchAll(
    /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\b/g,
  )) {
    const handle = normalizeHandle(match[0]);
    if (handle !== undefined) handles.add(handle);
  }
  return [...handles];
}

function normalizeNodeIdToken(raw: string): string | undefined {
  const value = raw
    .trim()
    .replace(/^[`"'([{]+/, "")
    .replace(/[`"',.;:)\]}]+$/, "");
  return /^[^\s#]+#[^\s#]+:(class|interface|type|enum|function|method|variable|property)$/.test(
    value,
  )
    ? value
    : undefined;
}

function normalizeHandle(raw: string): string | undefined {
  const value = raw.trim();
  return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value)
    ? value
    : undefined;
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
