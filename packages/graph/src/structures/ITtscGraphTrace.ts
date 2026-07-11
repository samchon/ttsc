import { ITtscGraphEvidence } from "./ITtscGraphEvidence";
import { ITtscGraphNext } from "./ITtscGraphNext";

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

  /** Compact hop summaries preserving node names and edge evidence, capped. */
  steps?: string[];

  /** How to use this source-free result next. */
  next: ITtscGraphNext;

  /** Human-readable compatibility note mirroring `next`. */
  guide: string;

  /** When `from` was an ambiguous name, the matches to disambiguate with. */
  candidates?: ITtscGraphTrace.INode[];
}
export namespace ITtscGraphTrace {
  /** Where and how far to trace dependency flow. */
  export interface IRequest {
    /** Discriminator for dependency tracing. */
    type: "trace";

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
     * trace. Prefer this path mode whenever both ends are known.
     */
    to?: string;

    /**
     * `forward` follows what the start uses (callees, instantiations, renders);
     * `reverse` follows what uses the start (callers); `impact` is a reverse
     * trace that prioritizes public API and test nodes a change would reach.
     * Its test nodes are semantic usage edges, not a text-search inventory.
     * Caller questions usually fit `reverse`.
     *
     * @default "forward"
     */
    direction?: "forward" | "reverse" | "impact";

    /**
     * Which non-structural edge family to follow: `execution` follows runtime
     * calls, instantiations, property access, and JSX renders; `types` follows
     * type references and inheritance; `all` preserves the full graph. Flow
     * questions should usually choose `execution` rather than `all`.
     *
     * @default "all"
     */
    focus?: "all" | "execution" | "types";

    /**
     * How many hops deep to follow. Open forward/reverse traces are capped at
     * 2; impact traces at 4; path mode at 12.
     *
     * Prefer the default for open traces. Raise only for path mode or when the
     * previous trace named the missing next hop.
     *
     * @default 2
     */
    maxDepth?: number;

    /**
     * Cap on reached nodes; the trace stops and marks itself truncated past it.
     * Open forward/reverse traces are capped at 8 nodes, impact at 16 nodes.
     *
     * Prefer the default; use larger open traces only when a named missing edge
     * requires it.
     *
     * @default 6
     */
    maxNodes?: number;

    /**
     * Include dependency-boundary nodes from node_modules or bundled `.d.ts`
     * libraries. Leave false for source-flow tours; enable only when the user
     * asks about external type/API boundaries.
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

    /**
     * Source span for the expression that produced this hop. It is repository
     * evidence for the hop and can be cited without opening the file.
     */
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
