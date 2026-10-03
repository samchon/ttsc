import { TtscGraphMemory } from "../../../../packages/graph/src/model/TtscGraphMemory";
import { resolveGraphHandle } from "../../../../packages/graph/src/server/resolveHandle";

import type { ITtscGraphDump } from "../../../../packages/graph/src/structures/ITtscGraphDump";

export type ResolverGraphNode = ITtscGraphDump.INode;
type ResolverGraphEdge = ITtscGraphDump.IEdge;
export type GraphMemory = TtscGraphMemory;

/** Resolve a handle through the authored memory indexes and resolver. */
export function resolveSyntheticGraph(
  nodes: ResolverGraphNode[],
  handle: string,
  candidateLimit = 12,
  edges: ResolverGraphEdge[] = [],
): ReturnType<typeof resolveGraphHandle> {
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
    tsconfig: "tsconfig.json",
    provenance: {
      schemaVersion: 8,
      capabilities: [],
      producer: { tool: "unit-fixture", version: "", typescript: "" },
      universe: { configs: [], roots: [] },
      sources: [],
    },
    diagnostics: [],
    nodes,
    edges,
  });
  return graph;
}
