import { TestProject } from "@ttsc/testing";

import { resolveGraphLauncher, resolveTtscgraphBinary } from "./ttsgraph";

export interface GraphDump {
  project: string;
  tsconfig: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  kind: string;
  name: string;
  file: string;
  external: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: string;
  evidence?: { file?: string; startLine?: number };
}

export function dumpGraph(cwd: string, tsconfig: string): GraphDump {
  const result = TestProject.spawn(
    process.execPath,
    [resolveGraphLauncher(), "dump", "--cwd", cwd, "--tsconfig", tsconfig],
    {
      env: { TTSC_GRAPH_BINARY: resolveTtscgraphBinary() },
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `@ttsc/graph dump failed with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout) as GraphDump;
}

export function findNode(
  dump: GraphDump,
  props: { file: string; name: string; kind: string },
): GraphNode | undefined {
  return dump.nodes.find(
    (node) =>
      node.file === props.file &&
      node.name === props.name &&
      node.kind === props.kind,
  );
}

export function findEdge(
  dump: GraphDump,
  from: GraphNode,
  to: GraphNode,
  kind: string,
): GraphEdge | undefined {
  return dump.edges.find(
    (edge) => edge.from === from.id && edge.to === to.id && edge.kind === kind,
  );
}
