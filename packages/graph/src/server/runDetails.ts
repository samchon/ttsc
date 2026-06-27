import fs from "node:fs";
import path from "node:path";

import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphDecorator } from "../structures/ITtscGraphDecorator";
import { ITtscGraphDetails } from "../structures/ITtscGraphDetails";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { accessAliasesFor } from "./accessAliases";
import { resolveGraphHandle } from "./resolveHandle";

// A signature is the declaration head up to the body brace: a handful of lines.
const MAX_SIGNATURE_LINES = 6;
// Neighbor lists are a map, not a dump; keep them scannable.
const DEFAULT_NEIGHBORS = 6;
const MAX_NEIGHBORS = 12;
// A container's outline can be long (a big class); keep it bounded.
const MAX_MEMBERS = 80;
// Structural relationships are navigation, not the dependency picture details is for.
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);
// Kinds whose value is their member outline, not implementation text.
const CONTAINER_KINDS = new Set<string>([
  "class",
  "interface",
  "namespace",
  "module",
  "enum",
  "file",
]);

/**
 * Resolve each handle to its declared shape: sourceSpan anchors, signature,
 * direct dependencies, and for containers, member outlines. It answers from the
 * graph's resolved structure instead of inlining implementation bodies.
 */
export function runDetails(
  graph: TtscGraphMemory,
  props: ITtscGraphDetails.IRequest,
): ITtscGraphDetails {
  const neighborLimit = bound(
    props.neighborLimit,
    DEFAULT_NEIGHBORS,
    1,
    MAX_NEIGHBORS,
  );
  const wantNeighbors = props.neighbors === true;
  const nodes: ITtscGraphDetails.INode[] = [];
  const unknown: string[] = [];
  for (const handle of props.handles) {
    const resolved = resolveGraphHandle(graph, handle);
    if (resolved.node === undefined) {
      unknown.push(handle);
      continue;
    }
    const node = resolved.node;
    const detail: ITtscGraphDetails.INode = {
      id: node.id,
      name: node.qualifiedName ?? node.name,
      kind: node.kind,
      file: node.file,
    };
    if (node.evidence?.startLine) detail.line = node.evidence.startLine;
    const sig = signatureOf(graph.project, node);
    if (sig !== undefined) detail.signature = sig;
    const signatureLiterals = literalSummaries(sig);
    const decorators = decoratorsOf(node);
    if (decorators !== undefined) detail.decorators = decorators;
    const implementation = evidenceCoordinatesOf(node.implementation);
    if (implementation !== undefined) detail.implementation = implementation;
    const span = implementation ?? evidenceCoordinatesOf(node.evidence);
    if (span !== undefined) {
      detail.sourceSpan = {
        file: span.file,
        startLine: span.startLine,
        endLine: span.endLine,
      };
    }
    const calls = dependencyRefs(graph, node, executionKinds, 6);
    if (calls.length > 0) detail.calls = calls;
    const types = dependencyRefs(graph, node, typeKinds, 6);
    if (types.length > 0) detail.types = types;
    if (CONTAINER_KINDS.has(node.kind)) {
      const list = members(graph, node);
      if (list.length > 0) detail.members = list;
    }
    if (signatureLiterals.length > 0)
      detail.literals = signatureLiterals.slice(0, 12);
    if (wantNeighbors) {
      detail.dependsOn = refs(
        graph,
        graph.outgoing(node.id),
        "to",
        neighborLimit,
      );
      detail.dependedOnBy = refs(
        graph,
        graph.incoming(node.id),
        "from",
        neighborLimit,
      );
    }
    nodes.push(detail);
  }
  return { type: "details", nodes, unknown };
}

/** The members a container owns (via `contains`), each with its own signature. */
function members(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): ITtscGraphDetails.IMember[] {
  const out: ITtscGraphDetails.IMember[] = [];
  for (const edge of graph.outgoing(node.id)) {
    if (edge.kind !== "contains") continue;
    const member = graph.node(edge.to);
    if (member === undefined) continue;
    const m: ITtscGraphDetails.IMember = {
      name: member.qualifiedName ?? member.name,
      kind: member.kind,
    };
    if (member.evidence?.startLine) m.line = member.evidence.startLine;
    const sig = signatureOf(graph.project, member);
    if (sig !== undefined) m.signature = sig;
    const decorators = decoratorsOf(member);
    if (decorators !== undefined) m.decorators = decorators;
    out.push(m);
    if (out.length >= MAX_MEMBERS) break;
  }
  return out;
}

/** Map dependency edges to references on their far endpoint, dropping structure. */
function refs(
  graph: TtscGraphMemory,
  edges: readonly ITtscGraphEdge[],
  end: "to" | "from",
  limit: number,
): ITtscGraphDetails.IReference[] {
  const ranked: Array<{ ref: ITtscGraphDetails.IReference; rank: number }> = [];
  for (const edge of edges) {
    if (STRUCTURAL_KINDS.has(edge.kind)) continue;
    const other = graph.node(end === "to" ? edge.to : edge.from);
    if (other === undefined) continue;
    const ref: ITtscGraphDetails.IReference = {
      id: other.id,
      name: other.qualifiedName ?? other.name,
      kind: other.kind,
      file: other.file,
      relation: edge.kind,
    };
    if (other.evidence?.startLine) ref.line = other.evidence.startLine;
    const evidence = edgeEvidenceOf(edge);
    if (evidence !== undefined) ref.evidence = evidence;
    const aliases = accessAliasesFor(other, edgeEvidenceTextOf(edge));
    if (aliases !== undefined) ref.aliases = aliases;
    ranked.push({ ref, rank: refRank(ref, edge) });
  }
  ranked.sort((a, b) => a.rank - b.rank);
  const out: ITtscGraphDetails.IReference[] = [];
  for (const item of ranked) {
    out.push(item.ref);
    if (out.length >= limit) break;
  }
  return out;
}

const executionKinds = new Set([
  "calls",
  "instantiates",
  "accesses",
  "renders",
]);
const typeKinds = new Set(["type_ref", "extends", "implements", "overrides"]);

function dependencyRefs(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  kinds: ReadonlySet<string>,
  limit: number,
): ITtscGraphDetails.IReference[] {
  const ranked: Array<{ ref: ITtscGraphDetails.IReference; rank: number }> = [];
  for (const edge of graph.outgoing(node.id)) {
    if (!kinds.has(edge.kind)) continue;
    const other = graph.node(edge.to);
    if (other === undefined || other.kind === "file") continue;
    const name = other.qualifiedName ?? other.name;
    const ref: ITtscGraphDetails.IReference = {
      id: other.id,
      name,
      kind: other.kind,
      file: other.file,
      relation: edge.kind,
    };
    if (other.evidence?.startLine) ref.line = other.evidence.startLine;
    const evidence = edgeEvidenceOf(edge);
    if (evidence !== undefined) ref.evidence = evidence;
    const aliases = accessAliasesFor(other, edgeEvidenceTextOf(edge));
    if (aliases !== undefined) ref.aliases = aliases;
    ranked.push({
      ref,
      rank: refRank(ref, edge),
    });
  }
  ranked.sort((a, b) => a.rank - b.rank);
  const out: ITtscGraphDetails.IReference[] = [];
  const seen = new Set<string>();
  for (const item of ranked) {
    const key = `${item.ref.relation}:${item.ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.ref);
    if (out.length >= limit) break;
  }
  return out;
}

function literalSummaries(text: string | undefined): string[] {
  if (text === undefined) return [];
  const out: string[] = [];
  for (const match of text.matchAll(/(["'`])((?:\\.|(?!\1).){1,80})\1/g)) {
    const value = cleanLiteral(match[2]);
    if (value !== undefined && !out.includes(value)) out.push(value);
    if (out.length >= 20) break;
  }
  return out;
}

function cleanLiteral(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  if (
    text === undefined ||
    text === "" ||
    text.length > 40 ||
    /^[{}()[\],.:;]+$/.test(text)
  ) {
    return undefined;
  }
  return text;
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

function refRank(
  ref: ITtscGraphDetails.IReference,
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

/** Decorator facts already captured on a node, omitted when absent. */
export function decoratorsOf(
  node: ITtscGraphNode,
): ITtscGraphDecorator[] | undefined {
  return node.decorators !== undefined && node.decorators.length > 0
    ? node.decorators
    : undefined;
}

/** Relationship evidence as public coordinates, omitted when absent. */
export function edgeEvidenceOf(
  edge: ITtscGraphEdge,
): ITtscGraphEvidence | undefined {
  return evidenceCoordinatesOf(edge.evidence);
}

function evidenceCoordinatesOf(
  evidence: ITtscGraphEvidence | undefined,
): ITtscGraphEvidence | undefined {
  if (evidence === undefined) return undefined;
  return {
    file: evidence.file,
    startLine: evidence.startLine,
    ...(evidence.startCol !== undefined ? { startCol: evidence.startCol } : {}),
    ...(evidence.endLine !== undefined ? { endLine: evidence.endLine } : {}),
    ...(evidence.endCol !== undefined ? { endCol: evidence.endCol } : {}),
  };
}

/** Source text is an internal alias hint, not part of the MCP evidence object. */
export function edgeEvidenceTextOf(edge: ITtscGraphEdge): string | undefined {
  const text = (
    edge.evidence as (ITtscGraphEvidence & { text?: string }) | undefined
  )?.text;
  return typeof text === "string" && text.length > 0 ? text : undefined;
}

/** Read a file's lines once, or undefined when it cannot be read. */
function fileLines(project: string, file: string): string[] | undefined {
  if (file === "") return undefined;
  try {
    return fs.readFileSync(path.join(project, file), "utf8").split(/\r?\n/);
  } catch {
    return undefined;
  }
}

/**
 * The declaration signature: the head of the declaration up to and including
 * the line that opens its body (`{`), or the single declaration line when there
 * is no brace, capped so a wrapped signature cannot run away.
 */
export function signatureOf(
  project: string,
  node: ITtscGraphNode,
): string | undefined {
  const evidence = node.evidence;
  const lines =
    evidence === undefined ? undefined : fileLines(project, evidence.file);
  if (lines === undefined || evidence === undefined) return undefined;
  const start = Math.max(0, evidence.startLine - 1);
  const out: string[] = [];
  for (
    let i = start;
    i < lines.length && out.length < MAX_SIGNATURE_LINES;
    i++
  ) {
    const line = lines[i];
    if (line === undefined) break;
    out.push(line);
    if (line.includes("{")) break;
  }
  const text = out.join("\n").trim();
  return text === "" ? undefined : text;
}
