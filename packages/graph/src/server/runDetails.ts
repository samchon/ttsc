import fs from "node:fs";
import path from "node:path";

import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphDecorator } from "../structures/ITtscGraphDecorator";
import { ITtscGraphDetails } from "../structures/ITtscGraphDetails";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { isExternalNode } from "./pathPolicy";
import { resolveGraphHandle } from "./resolveHandle";
import { resultGuide, resultNext } from "./resultGuide";

// A signature is the declaration head up to the body brace: a handful of lines.
const MAX_SIGNATURE_LINES = 4;
// Neighbor lists are a map, not a dump; keep them scannable.
const DEFAULT_NEIGHBORS = 2;
const MAX_NEIGHBORS = 3;
// A container outline can be long; default to a scannable first page.
const DEFAULT_MEMBERS = 6;
const MAX_MEMBERS = 8;
// Direct dependency groups are orientation slices, not full fan-out dumps.
const DEFAULT_DEPENDENCIES = 2;
const MAX_DEPENDENCIES = 4;
// Object literal outlines are navigation aids, not source excerpts.
const MAX_OBJECT_MEMBER_LINES = 300;
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
  const memberLimit = bound(props.memberLimit, DEFAULT_MEMBERS, 1, MAX_MEMBERS);
  const dependencyLimit = bound(
    props.dependencyLimit,
    DEFAULT_DEPENDENCIES,
    1,
    MAX_DEPENDENCIES,
  );
  const wantNeighbors = props.neighbors === true;
  const includeExternal = props.includeExternal === true;
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
    const calls = dependencyRefs(
      graph,
      node,
      executionKinds,
      dependencyLimit,
      includeExternal,
    );
    if (calls.length > 0) detail.calls = calls;
    const types = dependencyRefs(
      graph,
      node,
      typeKinds,
      dependencyLimit,
      includeExternal,
    );
    if (types.length > 0) detail.types = types;
    const implementedBy = incomingDependencyRefs(
      graph,
      node,
      implementationKinds,
      dependencyLimit,
      includeExternal,
    );
    if (implementedBy.length > 0) detail.implementedBy = implementedBy;
    if (CONTAINER_KINDS.has(node.kind)) {
      const list = members(graph, node, memberLimit);
      if (list.length > 0) detail.members = list;
    }
    if (node.kind === "variable" && detail.sourceSpan !== undefined) {
      const list = objectLiteralMembers(
        graph.project,
        detail.sourceSpan,
        memberLimit,
      );
      if (list.length > 0) detail.members = list;
    }
    if (signatureLiterals.length > 0)
      detail.literals = signatureLiterals.slice(0, 6);
    if (wantNeighbors) {
      detail.dependsOn = refs(
        graph,
        graph.outgoing(node.id),
        "to",
        neighborLimit,
        includeExternal,
      );
      detail.dependedOnBy = refs(
        graph,
        graph.incoming(node.id),
        "from",
        neighborLimit,
        includeExternal,
      );
    }
    nodes.push(detail);
  }
  return {
    type: "details",
    nodes,
    next: resultNext(
      "answer",
      "Selected signatures, members, dependencies, implementation candidates, and ranges are enough for a shape or reading-anchor answer.",
    ),
    guide: resultGuide(
      "Use signatures, members, calls, types, implementedBy, literals, and sourceSpan anchors as selected symbol facts.",
    ),
    unknown,
  };
}

/** The members a container owns (via `contains`), each with its own signature. */
function members(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  limit: number,
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
    if (out.length >= limit) break;
  }
  return out;
}

function objectLiteralMembers(
  project: string,
  span: Pick<ITtscGraphEvidence, "file" | "startLine" | "endLine">,
  limit: number,
): ITtscGraphDetails.IMember[] {
  if (span.endLine === undefined) return [];
  if (span.endLine - span.startLine > MAX_OBJECT_MEMBER_LINES) return [];
  const lines = fileLines(project, span.file);
  if (lines === undefined) return [];
  const start = Math.max(0, span.startLine - 1);
  const end = Math.min(lines.length - 1, span.endLine - 1);
  const members: ITtscGraphDetails.IMember[] = [];
  let depth = 0;
  let entered = false;
  for (let i = start; i <= end; i++) {
    const raw = lines[i] ?? "";
    const text = stripStrings(raw);
    const before = depth;
    if (entered && before === 1) {
      const member = objectMemberOf(raw, i + 1);
      if (member !== undefined) {
        members.push(member);
        if (members.length >= limit) break;
      }
    }
    for (const char of text) {
      if (char === "{") {
        depth++;
        entered = true;
      } else if (char === "}") {
        depth = Math.max(0, depth - 1);
      }
    }
  }
  return members;
}

function objectMemberOf(
  line: string,
  lineNumber: number,
): ITtscGraphDetails.IMember | undefined {
  const text = line.trim();
  if (
    text === "" ||
    text.startsWith("//") ||
    text.startsWith("/*") ||
    text.startsWith("*")
  ) {
    return undefined;
  }
  const property = /^(['"]?)([A-Za-z_$][\w$-]*)\1\s*\??\s*:/.exec(text);
  if (property !== null) {
    return {
      name: property[2]!,
      kind: "property",
      line: lineNumber,
      signature: signatureLine(text),
    };
  }
  const method =
    /^(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$-]*)\s*\(/.exec(text);
  if (method !== null) {
    return {
      name: method[1]!,
      kind: "method",
      line: lineNumber,
      signature: signatureLine(text),
    };
  }
  return undefined;
}

function signatureLine(text: string): string {
  return text.replace(/\s+/g, " ").replace(/,$/, "");
}

function stripStrings(line: string): string {
  return line.replace(/\/\/.*$/, "").replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "");
}

/** Map dependency edges to references on their far endpoint, dropping structure. */
function refs(
  graph: TtscGraphMemory,
  edges: readonly ITtscGraphEdge[],
  end: "to" | "from",
  limit: number,
  includeExternal: boolean,
): ITtscGraphDetails.IReference[] {
  const ranked: Array<{ ref: ITtscGraphDetails.IReference; rank: number }> = [];
  for (const edge of edges) {
    if (STRUCTURAL_KINDS.has(edge.kind)) continue;
    const other = graph.node(end === "to" ? edge.to : edge.from);
    if (other === undefined) continue;
    if (!includeExternal && isExternalNode(other)) continue;
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
const implementationKinds = new Set(["implements", "overrides"]);

function dependencyRefs(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  kinds: ReadonlySet<string>,
  limit: number,
  includeExternal: boolean,
): ITtscGraphDetails.IReference[] {
  const ranked: Array<{ ref: ITtscGraphDetails.IReference; rank: number }> = [];
  for (const edge of graph.outgoing(node.id)) {
    if (!kinds.has(edge.kind)) continue;
    const other = graph.node(edge.to);
    if (other === undefined || other.kind === "file") continue;
    if (!includeExternal && isExternalNode(other)) continue;
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

function incomingDependencyRefs(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  kinds: ReadonlySet<string>,
  limit: number,
  includeExternal: boolean,
): ITtscGraphDetails.IReference[] {
  const ranked: Array<{ ref: ITtscGraphDetails.IReference; rank: number }> = [];
  for (const edge of graph.incoming(node.id)) {
    if (!kinds.has(edge.kind)) continue;
    const other = graph.node(edge.from);
    if (other === undefined || other.kind === "file") continue;
    if (!includeExternal && isExternalNode(other)) continue;
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
    if (line.includes("{") || line.trimEnd().endsWith(";")) break;
  }
  const text = out.join("\n").trim();
  return text === "" ? undefined : text;
}
