import { ITtscGraphEdge } from "./ITtscGraphEdge";
import { ITtscGraphNode } from "./ITtscGraphNode";
import { ITtscGraphSpan } from "./ITtscGraphSpan";

/**
 * The whole-graph export `ttscgraph dump` writes and the MCP server loads — the
 * wire contract between the Go fact-builder and the TypeScript graph engine.
 *
 * It is the complete graph with none of the per-response caps the MCP tools
 * apply: every node and edge the build resolved. The server parses each changed
 * native snapshot (typia-validated) into an in-memory resident graph and reuses
 * that warm model while project inputs stay unchanged; the bundled 3D viewer
 * reduces the same dump.
 *
 * Paths in `project` and `tsconfig` are absolute; `file` fields on nodes and
 * edges are project-relative.
 */
export interface ITtscGraphDump {
  /** Absolute path of the project root the graph was built for. */
  project: string;

  /** The tsconfig the program was loaded from, relative to `project`. */
  tsconfig: string;

  /** Every node the build recorded. */
  nodes: ITtscGraphDump.INode[];

  /** Every edge the build resolved. */
  edges: ITtscGraphDump.IEdge[];
}

export namespace ITtscGraphDump {
  /**
   * A node as the builder sends it: the graph node, minus the file paths inside
   * its spans, which the loader puts back from the node's own `file`.
   *
   * A node's declaration span is in the node's file, always — the path in the
   * span was the same string a second time, once per node. It is the reader's
   * to reconstruct, and {@link TtscGraphMemory} does, so nothing downstream of
   * the loader sees a span without its file.
   */
  export interface INode extends Omit<
    ITtscGraphNode,
    "evidence" | "implementation"
  > {
    /** Declaration span; its file is this node's `file`. */
    evidence?: ITtscGraphSpan;

    /**
     * Implementation span. This one keeps its file when it has one: an
     * implementation genuinely can live in another file from its declaration.
     */
    implementation?: ITtscGraphSpan;
  }

  /**
   * An edge as the builder sends it. Its span is in the file its `from` id
   * names — the id is `path#Qualified.Name:kind` — so the path rode the wire a
   * second time on every edge, and edges outnumber nodes several times over.
   */
  export interface IEdge extends Omit<ITtscGraphEdge, "evidence"> {
    /** Expression span; its file is the one embedded in `from`. */
    evidence?: ITtscGraphSpan;
  }
}
