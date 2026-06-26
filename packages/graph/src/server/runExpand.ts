import fs from "node:fs";
import path from "node:path";

import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphExpand } from "../structures/ITtscGraphExpand";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";

// A whole declaration body can be large, so the full source is opt-in and capped
// when asked for; the default response carries only the declared shape.
const MAX_SOURCE_LINES = 200;
// A signature is the declaration head up to the body brace — a handful of lines.
const MAX_SIGNATURE_LINES = 6;
// Neighbor lists are a map, not a dump; keep them scannable.
const MAX_NEIGHBORS = 40;
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
 * Resolve each handle to its declared shape — its signature, and for a container
 * the outline of its members — and, only when asked, its full source body. This
 * is the graph's edge over a plain file read: it answers from the resolved
 * structure it already holds, so the agent reads compact shape, not inlined code,
 * unless it explicitly needs a body's logic.
 */
export function runExpand(
  graph: TtscGraphMemory,
  props: ITtscGraphExpand.IProps,
): ITtscGraphExpand {
  const wantSource = props.source === true;
  const nodes: ITtscGraphExpand.INode[] = [];
  const unknown: string[] = [];
  for (const handle of props.handles) {
    const node = graph.node(handle);
    if (node === undefined) {
      unknown.push(handle);
      continue;
    }
    const expanded: ITtscGraphExpand.INode = {
      id: node.id,
      name: node.qualifiedName ?? node.name,
      kind: node.kind,
      file: node.file,
    };
    if (node.evidence?.startLine) expanded.line = node.evidence.startLine;
    const sig = signatureOf(graph.project, node);
    if (sig !== undefined) expanded.signature = sig;
    if (CONTAINER_KINDS.has(node.kind)) {
      const list = members(graph, node);
      if (list.length > 0) expanded.members = list;
    }
    if (wantSource) {
      const source = readSource(graph.project, node);
      if (source !== undefined) {
        expanded.source = source.text;
        if (source.truncated) expanded.truncated = true;
      }
    }
    if (props.neighbors === true) {
      expanded.dependsOn = refs(graph, graph.outgoing(node.id), "to");
      expanded.dependedOnBy = refs(graph, graph.incoming(node.id), "from");
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
): ITtscGraphExpand.IReference[] {
  const out: ITtscGraphExpand.IReference[] = [];
  for (const edge of edges) {
    if (STRUCTURAL_KINDS.has(edge.kind)) continue;
    const other = graph.node(end === "to" ? edge.to : edge.from);
    if (other === undefined) continue;
    out.push({
      id: other.id,
      name: other.qualifiedName ?? other.name,
      kind: other.kind,
      relation: edge.kind,
    });
    if (out.length >= MAX_NEIGHBORS) break;
  }
  return out;
}

/** Read a file's lines once, or undefined when it cannot be read. */
function fileLines(project: string, node: ITtscGraphNode): string[] | undefined {
  if (node.evidence === undefined || node.file === "") return undefined;
  try {
    return fs.readFileSync(path.join(project, node.file), "utf8").split(/\r?\n/);
  } catch {
    return undefined;
  }
}

/**
 * The declaration signature: the head of the declaration up to and including the
 * line that opens its body (`{`), or the single declaration line when there is
 * no brace, capped so a wrapped signature cannot run away.
 */
export function signatureOf(project: string, node: ITtscGraphNode): string | undefined {
  const lines = fileLines(project, node);
  const evidence = node.evidence;
  if (lines === undefined || evidence === undefined) return undefined;
  const start = Math.max(0, evidence.startLine - 1);
  const out: string[] = [];
  for (let i = start; i < lines.length && out.length < MAX_SIGNATURE_LINES; i++) {
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
): { text: string; truncated: boolean } | undefined {
  const lines = fileLines(project, node);
  const evidence = node.evidence;
  if (lines === undefined || evidence === undefined) return undefined;
  const start = Math.max(0, evidence.startLine - 1);
  const end = Math.min(evidence.endLine ?? evidence.startLine, lines.length);
  let slice = lines.slice(start, Math.max(start + 1, end));
  let truncated = false;
  if (slice.length > MAX_SOURCE_LINES) {
    slice = slice.slice(0, MAX_SOURCE_LINES);
    truncated = true;
  }
  return { text: slice.join("\n"), truncated };
}
