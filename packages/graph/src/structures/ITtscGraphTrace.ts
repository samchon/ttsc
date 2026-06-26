/**
 * The ordered dependency flow the `graph_trace` tool returns from a start
 * symbol.
 */
export interface ITtscGraphTrace {
  /** The resolved start node, or undefined when `from` matched nothing. */
  start?: ITtscGraphTrace.INode;

  direction: string;

  /** Edges traversed, in breadth-first order. */
  hops: ITtscGraphTrace.IHop[];

  /** Unique nodes reached (excluding the start), each with its depth and roles. */
  reached: ITtscGraphTrace.INode[];

  /** True when the trace hit maxNodes or maxDepth and more flow exists. */
  truncated: boolean;

  /** The resolved `to` target, when a path was requested. */
  target?: ITtscGraphTrace.INode;

  /**
   * When `to` was given: the ordered dependency path from `from` to `to`
   * (`from` first, `to` last), or empty when `to` is not reachable from `from`.
   */
  path?: ITtscGraphTrace.INode[];

  /** When `from` was an ambiguous name, the matches to disambiguate with. */
  candidates?: ITtscGraphTrace.INode[];
}
export namespace ITtscGraphTrace {
  /** Where and how far to trace dependency flow. */
  export interface IProps {
    /**
     * Where to start: a node id from another tool, or a symbol name. An
     * ambiguous name returns its candidates instead of a trace.
     */
    from: string;

    /**
     * A target symbol (id or name). When given, the tool returns the dependency
     * path from `from` to this target — the one-call answer for "how does A
     * reach B" — instead of an open-ended trace.
     */
    to?: string;

    /**
     * `forward` follows what the start uses (callees, instantiations, renders);
     * `reverse` follows what uses the start (callers); `impact` is a reverse
     * trace that flags the public API and tests a change would reach.
     *
     * @default "forward"
     */
    direction?: "forward" | "reverse" | "impact";

    /**
     * How many hops deep to follow.
     *
     * @default 6
     */
    maxDepth?: number;

    /**
     * Cap on reached nodes; the trace stops and marks itself truncated past it.
     *
     * @default 60
     */
    maxNodes?: number;
  }

  /** One traversed edge, with its depth from the start. */
  export interface IHop {
    from: string;
    to: string;
    kind: string;
    /** Hops from the start (1 = direct). */
    depth: number;
  }

  /** A node on the trace: the start, a reached node, or a candidate. */
  export interface INode {
    id: string;
    name: string;
    kind: string;
    file: string;
    /** Hops from the start, on a reached node. */
    depth?: number;
    /** The node's signature — carried on path nodes so the path explains itself. */
    signature?: string;
    /** Why this node matters to an impact trace: `exported`, `test`. */
    roles?: string[];
  }
}
