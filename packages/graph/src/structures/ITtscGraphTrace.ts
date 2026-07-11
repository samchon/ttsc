import { ITtscGraphEvidence } from "./ITtscGraphEvidence";

/** The compact dependency or caller flow returned from a selected start symbol. */
export interface ITtscGraphTrace {
  /** Discriminator for dependency tracing. */
  type: "trace";

  /** The resolved start node, or undefined when `from` matched nothing. */
  start?: ITtscGraphTrace.INode;

  /** Trace direction actually used by this result. */
  direction: string;

  /** Edges traversed, in breadth-first order. */
  hops: ITtscGraphTrace.IHop[];

  /** Unique nodes reached (excluding the start), each with its depth and roles. */
  reached: ITtscGraphTrace.INode[];

  /** True when the trace hit its node or depth cap; the returned flow stands. */
  truncated: boolean;

  /** The resolved `to` target, when a path was requested. */
  target?: ITtscGraphTrace.INode;

  /**
   * Ordered dependency path from `from` to `to` when `to` was given (`from`
   * first, `to` last), empty when `to` is unreachable.
   */
  path?: ITtscGraphTrace.INode[];

  /** Compact hop summaries preserving node names and edge evidence, capped. */
  steps?: string[];

  /** When `from` was an ambiguous name, the matches to disambiguate with. */
  candidates?: ITtscGraphTrace.INode[];
}
export namespace ITtscGraphTrace {
  /** Where and how far to trace dependency flow. */
  export interface IRequest {
    /** Discriminator for dependency tracing. */
    type: "trace";

    /**
     * Where to start: a node id, a simple symbol name, or a dotted member
     * (`OrderService.create`). An ambiguous name returns its candidates instead
     * of a trace.
     */
    from: string;

    /**
     * Target symbol (node id, simple name, or dotted member). When given, the
     * tool returns the dependency path from `from` to it, the one-call answer
     * for "how does A reach B". Prefer this path mode whenever both ends are
     * known.
     */
    to?: string;

    /**
     * Trace direction:
     *
     * - `forward`: what the start uses (callees, instantiations, renders)
     * - `reverse`: what uses the start (callers); the usual fit for caller
     *   questions
     * - `impact`: reverse trace prioritizing public API and test nodes a change
     *   reaches; its test nodes are semantic usage edges, not a text search
     *
     * @default "forward"
     */
    direction?: "forward" | "reverse" | "impact";

    /**
     * Non-structural edge family to follow:
     *
     * - `execution`: runtime calls, instantiations, property access, JSX renders
     * - `types`: type references and inheritance
     * - `all`: the full graph
     *
     * Flow questions usually want `execution`, not `all`.
     *
     * @default "all"
     */
    focus?: "all" | "execution" | "types";

    /**
     * Hops deep to follow (open forward/reverse cap at 2, impact at 4, path
     * mode at 12). Raise it for path mode.
     *
     * @default 2
     */
    maxDepth?: number;

    /**
     * Cap on reached nodes (open forward/reverse cap at 8, impact at 16).
     *
     * @default 6
     */
    maxNodes?: number;

    /**
     * Include dependency-boundary nodes from node_modules or bundled `.d.ts`
     * libraries. Enable only for questions about external type/API boundaries.
     *
     * @default false
     */
    includeExternal?: boolean;
  }

  /** One traversed edge, with its depth from the start. */
  export interface IHop {
    /** Source node id for this traversed edge. */
    from: string;

    /** Target node id for this traversed edge. */
    to: string;

    /** Edge kind (`calls`, `type_ref`, `accesses`, ...). */
    kind: string;

    /** Hops from the start (1 = direct). */
    depth: number;

    /** Source span that produced the hop: citable without opening the file. */
    evidence?: ITtscGraphEvidence;
  }

  /** A node on the trace: the start, a reached node, or a candidate. */
  export interface INode {
    /** Stable node id for subsequent graph calls. */
    id: string;

    /** Qualified symbol name when available, otherwise the simple name. */
    name: string;

    /** Declaration kind (`class`, `method`, `function`, ...). */
    kind: string;

    /** Project-relative path of the declaration file. */
    file: string;

    /** 1-based declaration line, when known. */
    line?: number;

    /** Declaration or implementation citation range, when known. */
    sourceSpan?: Pick<ITtscGraphEvidence, "file" | "startLine" | "endLine">;

    /** Hops from the start, on a reached node. */
    depth?: number;

    /** The node's signature, carried on path nodes so the path explains itself. */
    signature?: string;

    /** Why this node matters to an impact trace: `exported`, `test`. */
    roles?: string[];
  }
}
