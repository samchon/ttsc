import fs from "node:fs";
import path from "node:path";

import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphExpand } from "../structures/ITtscGraphExpand";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";

// A declaration body can be large; cap each expansion so one call cannot flood
// the response, and flag the cut so the caller knows to narrow.
const MAX_LINES = 200;
// Neighbor lists are a map, not a dump; keep them scannable.
const MAX_NEIGHBORS = 40;
// Structural relationships are navigation, not the dependency picture expand is for.
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);

/**
 * Resolve each handle to its declaration source and, optionally, its dependency
 * neighbors. This is the source-read follow-up to the narrowing tools: the
 * graph located the symbol, expand opens it — no grep, no full-file read.
 */
export function runExpand(
  graph: TtscGraphMemory,
  props: ITtscGraphExpand.IProps,
): ITtscGraphExpand {
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
    const source = readSource(graph.project, node);
    if (source !== undefined) {
      expanded.source = source.text;
      if (source.truncated) expanded.truncated = true;
    }
    if (props.neighbors === true) {
      expanded.dependsOn = refs(graph, graph.outgoing(node.id), "to");
      expanded.dependedOnBy = refs(graph, graph.incoming(node.id), "from");
    }
    nodes.push(expanded);
  }
  return { nodes, unknown };
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

/** Slice a node's declaration source from disk, capped at MAX_LINES. */
function readSource(
  project: string,
  node: ITtscGraphNode,
): { text: string; truncated: boolean } | undefined {
  const evidence = node.evidence;
  if (evidence === undefined || node.file === "") return undefined;
  let text: string;
  try {
    text = fs.readFileSync(path.join(project, node.file), "utf8");
  } catch {
    return undefined;
  }
  const lines = text.split(/\r?\n/);
  const start = Math.max(0, evidence.startLine - 1);
  const end = Math.min(evidence.endLine ?? evidence.startLine, lines.length);
  let slice = lines.slice(start, Math.max(start + 1, end));
  let truncated = false;
  if (slice.length > MAX_LINES) {
    slice = slice.slice(0, MAX_LINES);
    truncated = true;
  }
  return { text: slice.join("\n"), truncated };
}
