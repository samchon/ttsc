import fs from "node:fs";
import path from "node:path";

import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphDecorator } from "../structures/ITtscGraphDecorator";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphExpand } from "../structures/ITtscGraphExpand";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { accessAliasesFor } from "./accessAliases";
import { resolveGraphHandle } from "./resolveHandle";

// A whole declaration body can be large, so the full source is opt-in and capped
// when asked for; the default response carries only the declared shape.
const MAX_SOURCE_LINES = 200;
// A signature is the declaration head up to the body brace: a handful of lines.
const MAX_SIGNATURE_LINES = 6;
// Neighbor lists are a map, not a dump; keep them scannable.
const DEFAULT_NEIGHBORS = 6;
const MAX_NEIGHBORS = 12;
// A container's outline can be long (a big class); keep it bounded.
const MAX_MEMBERS = 80;
// Structural relationships are navigation, not the dependency picture expand is for.
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);
// Kinds whose value is their member outline, not a source body.
const CONTAINER_KINDS = new Set<string>([
  "class",
  "interface",
  "namespace",
  "module",
  "enum",
  "file",
]);

/**
 * Resolve each handle to its declared shape: its signature, and for a container
 * the outline of its members, and only when asked, its full source body. This
 * is the graph's edge over a plain file read: it answers from the resolved
 * structure it already holds, so the agent reads compact shape, not inlined
 * code, unless it explicitly needs a body's logic.
 */
export function runExpand(
  graph: TtscGraphMemory,
  props: ITtscGraphExpand.IProps,
): ITtscGraphExpand {
  const wantSource = props.source === true;
  const neighborLimit = bound(
    props.neighborLimit,
    DEFAULT_NEIGHBORS,
    1,
    MAX_NEIGHBORS,
  );
  const wantNeighbors = props.neighbors === true && !wantSource;
  const nodes: ITtscGraphExpand.INode[] = [];
  const unknown: string[] = [];
  for (const handle of props.handles) {
    const resolved = resolveGraphHandle(graph, handle);
    if (resolved.node === undefined) {
      unknown.push(handle);
      continue;
    }
    const node = resolved.node;
    const expanded: ITtscGraphExpand.INode = {
      id: node.id,
      name: node.qualifiedName ?? node.name,
      kind: node.kind,
      file: node.file,
    };
    if (node.evidence?.startLine) expanded.line = node.evidence.startLine;
    const sig = signatureOf(graph.project, node);
    if (sig !== undefined) expanded.signature = sig;
    const signatureLiterals = literalSummaries(sig);
    const decorators = decoratorsOf(node);
    if (decorators !== undefined) expanded.decorators = decorators;
    if (node.implementation !== undefined)
      expanded.implementation = node.implementation;
    if (!wantSource) {
      const calls = dependencySummaries(graph, node, executionKinds, 6);
      if (calls.length > 0) expanded.calls = calls;
      const types = dependencySummaries(graph, node, typeKinds, 6);
      if (types.length > 0) expanded.types = types;
      if (CONTAINER_KINDS.has(node.kind)) {
        const list = members(graph, node);
        if (list.length > 0) expanded.members = list;
      }
    }
    let source:
      | {
          file: string;
          text: string;
          lines: ITtscGraphExpand.ISourceLine[];
          truncated: boolean;
          startLine: number;
          endLine: number;
        }
      | undefined;
    if (wantSource) {
      source = readSource(graph.project, node);
      if (source !== undefined) {
        expanded.source = source.text;
        expanded.sourceSpan = {
          file: source.file,
          startLine: source.startLine,
          endLine: source.endLine,
        };
        if (props.lineNumbers === true) expanded.sourceLines = source.lines;
        if (source.truncated) expanded.truncated = true;
      }
    } else if (signatureLiterals.length > 0) {
      expanded.literals = signatureLiterals.slice(0, 12);
    }
    if (wantNeighbors) {
      expanded.dependsOn = refs(
        graph,
        graph.outgoing(node.id),
        "to",
        neighborLimit,
      );
      expanded.dependedOnBy = refs(
        graph,
        graph.incoming(node.id),
        "from",
        neighborLimit,
      );
    }
    nodes.push(expanded);
  }
  return { nodes, unknown };
}

/** The members a container owns (via `contains`), each with its own signature. */
function members(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): ITtscGraphExpand.IMember[] {
  const out: ITtscGraphExpand.IMember[] = [];
  for (const edge of graph.outgoing(node.id)) {
    if (edge.kind !== "contains") continue;
    const member = graph.node(edge.to);
    if (member === undefined) continue;
    const m: ITtscGraphExpand.IMember = {
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
): ITtscGraphExpand.IReference[] {
  const ranked: Array<{ ref: ITtscGraphExpand.IReference; rank: number }> = [];
  for (const edge of edges) {
    if (STRUCTURAL_KINDS.has(edge.kind)) continue;
    const other = graph.node(end === "to" ? edge.to : edge.from);
    if (other === undefined) continue;
    const ref: ITtscGraphExpand.IReference = {
      id: other.id,
      name: other.qualifiedName ?? other.name,
      kind: other.kind,
      file: other.file,
      relation: edge.kind,
    };
    if (other.evidence?.startLine) ref.line = other.evidence.startLine;
    const evidence = edgeEvidenceOf(edge);
    if (evidence !== undefined) ref.evidence = evidence;
    const aliases = accessAliasesFor(other, evidence?.text);
    if (aliases !== undefined) ref.aliases = aliases;
    ranked.push({ ref, rank: refRank(ref, edge) });
  }
  ranked.sort((a, b) => a.rank - b.rank);
  const out: ITtscGraphExpand.IReference[] = [];
  for (const item of ranked) {
    out.push(item.ref);
    if (out.length >= limit) break;
  }
  return out;
}

const executionKinds = new Set(["calls", "instantiates", "renders"]);
const typeKinds = new Set(["type_ref", "extends", "implements", "overrides"]);

function dependencySummaries(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  kinds: ReadonlySet<string>,
  limit: number,
): string[] {
  const ranked: Array<{ text: string; rank: number }> = [];
  for (const edge of graph.outgoing(node.id)) {
    if (!kinds.has(edge.kind)) continue;
    const other = graph.node(edge.to);
    if (other === undefined || other.kind === "file") continue;
    const name = other.qualifiedName ?? other.name;
    const aliases = accessAliasesFor(other, edge.evidence?.text);
    const aliasText =
      aliases === undefined || aliases.length === 0
        ? name
        : `${aliases[0]} -> ${name}${aliases.length > 1 ? ` aliases ${aliases.slice(1).join(", ")}` : ""}`;
    ranked.push({
      text: aliasText,
      rank: refRank(
        {
          id: other.id,
          name,
          kind: other.kind,
          file: other.file,
          relation: edge.kind,
        },
        edge,
      ),
    });
  }
  ranked.sort((a, b) => a.rank - b.rank);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of ranked) {
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    out.push(item.text);
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
  ref: ITtscGraphExpand.IReference,
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

/** Relationship evidence already captured on an edge, omitted when absent. */
export function edgeEvidenceOf(
  edge: ITtscGraphEdge,
): ITtscGraphEvidence | undefined {
  return edge.evidence;
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

/** Slice a node's full declaration source from disk, capped at MAX_SOURCE_LINES. */
function readSource(
  project: string,
  node: ITtscGraphNode,
):
  | {
      file: string;
      text: string;
      lines: ITtscGraphExpand.ISourceLine[];
      truncated: boolean;
      startLine: number;
      endLine: number;
    }
  | undefined {
  const evidence = node.implementation ?? node.evidence;
  const lines =
    evidence === undefined ? undefined : fileLines(project, evidence.file);
  if (lines === undefined || evidence === undefined) return undefined;
  const start = Math.max(0, evidence.startLine - 1);
  const end = Math.min(evidence.endLine ?? evidence.startLine, lines.length);
  let slice = lines.slice(start, Math.max(start + 1, end));
  let truncated = false;
  if (slice.length > MAX_SOURCE_LINES) {
    slice = slice.slice(0, MAX_SOURCE_LINES);
    truncated = true;
  }
  return {
    file: evidence.file,
    text: slice.join("\n"),
    lines: slice.map((text, index) => ({
      line: start + index + 1,
      text,
    })),
    truncated,
    startLine: start + 1,
    endLine: start + slice.length,
  };
}
