import { ITtscGraphEvidence } from "./ITtscGraphEvidence";

/**
 * The ordered dependency flow returned from a start symbol.
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
   * (`from` first, `to` last), or empty when `to` is not reachable from
   * `from`.
   */
  path?: ITtscGraphTrace.INode[];

  /** Compact hop summaries preserving node names and edge evidence. */
  steps?: string[];

  /** Follow-up handles for expanding or continuing the trace. */
  next?: ITtscGraphTrace.INext;

  /** When `from` was an ambiguous name, the matches to disambiguate with. */
  candidates?: ITtscGraphTrace.INode[];
}
export namespace ITtscGraphTrace {
  /** Where and how far to trace dependency flow. */
  export interface IProps {
    /**
     * Where to start: a node id from another tool, a simple symbol name, or a
     * dotted member name such as `OrderService.create`. An ambiguous name
     * returns its candidates instead of a trace.
     */
    from: string;

    /**
     * A target symbol: node id, simple symbol name, or dotted member name. When
     * given, the tool returns the dependency path from `from` to this target,
     * the one-call answer for "how does A reach B", instead of an open-ended
     * trace.
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
     * Which non-structural edge family to follow: `execution` follows runtime
     * calls, instantiations, property access, and JSX renders; `types` follows
     * type references and inheritance; `all` preserves the full graph.
     *
     * @default "all"
     */
    focus?: "all" | "execution" | "types";

    /**
     * How many hops deep to follow. Open traces are capped at 6; path mode is
     * capped at 12.
     *
     * @default 6
     */
    maxDepth?: number;

    /**
     * Cap on reached nodes; the trace stops and marks itself truncated past it.
     * Open traces are capped at 30 nodes so a broad graph cannot flood
     * context.
     *
     * @default 30
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
    /**
     * Source span for the expression that produced this hop. It lets an agent
     * explain why the trace moves from one symbol to the next without opening
     * the file.
     */
    evidence?: ITtscGraphEvidence;
    /**
     * Stable access-path aliases derived from edge evidence. These preserve a
     * resolved member's owner and the concrete property path used at the call
     * site.
     */
    aliases?: string[];
  }

  /** A node on the trace: the start, a reached node, or a candidate. */
  export interface INode {
    id: string;
    name: string;
    kind: string;
    file: string;
    /** Hops from the start, on a reached node. */
    depth?: number;
    /** The node's signature, carried on path nodes so the path explains itself. */
    signature?: string;
    /** Why this node matters to an impact trace: `exported`, `test`. */
    roles?: string[];
  }

  /** Tool-call handles suggested by this trace. */
  export interface INext {
    /** Pass these ids to `symbol_details` for source or member details. */
    expand: string[];
    /** Continue tracing from these ids when the current result is intermediate. */
    traceFrom: string[];
  }
}
