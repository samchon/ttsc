import fs from "node:fs";
import path from "node:path";

import { GraphModel } from "../model/GraphModel";
import { IGraphEdge, IGraphNode } from "../schema";

/** Read the source and neighbors of nodes a previous tool returned as handles. */
export interface IExpandProps {
  /**
   * Node ids to expand, exactly as another tool returned them. Pass every
   * handle you need in one call.
   */
  handles: string[];

  /**
   * Also list each node's direct dependencies and dependents (the symbols it
   * uses and the symbols that use it).
   *
   * @default false
   */
  neighbors?: boolean;
}

export interface IExpandResult {
  nodes: IExpandedNode[];
  /** Handles that resolved to no node. */
  unknown: string[];
}

export interface IExpandedNode {
  id: string;
  name: string;
  kind: string;
  file: string;
  /** The declaration source, sliced from the node's evidence span. */
  source?: string;
  /** True when `source` was cut at the line cap. */
  truncated?: boolean;
  /** Symbols this node uses (outgoing dependency edges). */
  dependsOn?: IExpandRef[];
  /** Symbols that use this node (incoming dependency edges). */
  dependedOnBy?: IExpandRef[];
}

export interface IExpandRef {
  id: string;
  name: string;
  kind: string;
  /** The edge kind connecting the two (`calls`, `type_ref`, …). */
  relation: string;
}

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
  graph: GraphModel,
  props: IExpandProps,
): IExpandResult {
  const nodes: IExpandedNode[] = [];
  const unknown: string[] = [];
  for (const handle of props.handles) {
    const node = graph.node(handle);
    if (node === undefined) {
      unknown.push(handle);
      continue;
    }
    const expanded: IExpandedNode = {
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
  graph: GraphModel,
  edges: readonly IGraphEdge[],
  end: "to" | "from",
): IExpandRef[] {
  const out: IExpandRef[] = [];
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
  node: IGraphNode,
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
