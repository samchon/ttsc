import { ITtscGraphDiagnostic } from "./ITtscGraphDiagnostic";
import { ITtscGraphEdge } from "./ITtscGraphEdge";
import { ITtscGraphNode } from "./ITtscGraphNode";

/**
 * The whole-graph export `ttscgraph dump` writes and the MCP server loads — the
 * wire contract between the Go fact-builder and the TypeScript graph engine.
 *
 * It is the complete graph with none of the per-response caps the MCP tools
 * apply: every node and edge the build resolved. The server parses it once at
 * startup (typia-validated) into an in-memory resident graph and answers every
 * tool call from that warm model; the bundled 3D viewer reduces the same dump.
 *
 * Paths in `project` and `tsconfig` are absolute; `file` fields on nodes,
 * edges, and diagnostics are project-relative.
 */
export interface ITtscGraphDump {
  /** Absolute path of the project root the graph was built for. */
  project: string;

  /** The tsconfig the program was loaded from, relative to `project`. */
  tsconfig: string;

  /** Every node the build recorded. */
  nodes: ITtscGraphNode[];

  /** Every edge the build resolved. */
  edges: ITtscGraphEdge[];

  /**
   * Fused compiler and plugin diagnostics, when diagnostics were collected.
   * Absent when the dump was built without a diagnostics pass.
   */
  diagnostics?: ITtscGraphDiagnostic[];
}
