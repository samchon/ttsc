import { createRequire } from "node:module";
import path from "node:path";

export interface ResolverGraphNode {
  id: string;
  kind: "class" | "method" | "variable" | "property";
  name: string;
  qualifiedName?: string;
  file: string;
  external: boolean;
  exported?: boolean;
}

interface ResolverGraphEdge {
  from: string;
  to: string;
  kind: "calls" | "contains" | "exports";
}

export interface GraphMemory {
  node(id: string): ResolverGraphNode | undefined;
  nodes: readonly ResolverGraphNode[];
  outgoing(id: string): readonly ResolverGraphEdge[];
  incoming(id: string): readonly ResolverGraphEdge[];
  symbols(handle: string): readonly ResolverGraphNode[];
}

interface GraphMemoryConstructor {
  from(dump: {
    project: string;
    nodes: ResolverGraphNode[];
    edges: ResolverGraphEdge[];
  }): GraphMemory;
}

interface ResolvedGraphHandle {
  node?: ResolverGraphNode;
  candidates?: ResolverGraphNode[];
}

interface ResolveHandleModule {
  resolveGraphHandle(
    graph: GraphMemory,
    handle: string,
    candidateLimit?: number,
  ): ResolvedGraphHandle;
}

const require = createRequire(import.meta.url);
const graphEntry = require.resolve("@ttsc/graph");
const graphLib = path.dirname(graphEntry);
const { TtscGraphMemory } = require(
  path.join(graphLib, "model", "TtscGraphMemory.js"),
) as { TtscGraphMemory: GraphMemoryConstructor };
const { resolveGraphHandle } = require(
  path.join(graphLib, "server", "resolveHandle.js"),
) as ResolveHandleModule;

/** Resolve a handle through the package's built memory indexes and resolver. */
export function resolveSyntheticGraph(
  nodes: ResolverGraphNode[],
  handle: string,
  candidateLimit = 12,
  edges: ResolverGraphEdge[] = [],
): ResolvedGraphHandle {
  const graph = createSyntheticGraph(nodes, edges);
  return resolveGraphHandle(graph, handle, candidateLimit);
}

/** Build the package's real memory indexes from a compact synthetic dump. */
export function createSyntheticGraph(
  nodes: ResolverGraphNode[],
  edges: ResolverGraphEdge[] = [],
): GraphMemory {
  const graph = TtscGraphMemory.from({
    project: "C:/synthetic-graph",
    nodes,
    edges,
  });
  return graph;
}
