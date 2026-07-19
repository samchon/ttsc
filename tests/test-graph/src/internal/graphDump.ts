import { TestProject } from "@ttsc/testing";

import { resolveGraphLauncher, resolveTtscgraphBinary } from "./ttsgraph";

export interface GraphDump {
  project: string;
  tsconfig: string;
  diagnostics: GraphDiagnostic[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphDiagnostic {
  file: string;
  line: number;
  column: number;
  code: number;
  category: string;
  message: string;
}

export interface GraphNode {
  id: string;
  kind: string;
  name: string;
  qualifiedName?: string;
  file: string;
  external: boolean;
  evidence?: {
    file?: string;
    startLine?: number;
    startCol?: number;
    endLine?: number;
    endCol?: number;
  };
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
