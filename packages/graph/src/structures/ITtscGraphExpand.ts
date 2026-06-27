import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphEvidence } from "./ITtscGraphEvidence";

/**
 * The resolved symbol details returned for a set of handles.
 *
 * The default payload is source-free: signatures, member outlines, graph
 * summaries, and answer checklists. Source bodies are returned only when
 * requested.
 */
export interface ITtscGraphExpand {
  /**
   * Natural-language checklist derived from graph facts. It is meant to be
   * copied selectively into final answers when those exact names matter.
   */
  finalAnswerChecklist?: string[];

  /**
   * Exact identifiers and flow snippets to preserve in final answers. These
   * are mechanically derived from `nodes`, `calls`, `flow`, `types`, aliases,
   * and source spans, so they are a compact answer checklist rather than a
   * second inference layer.
   */
  answerChecklist?: ITtscGraphExpand.IAnswerChecklist;

  /**
   * Exact facts worth preserving in an answer, derived from the expanded
   * nodes. This is a compact checklist, not a separate inference layer.
   */
  answerFacts?: string[];

  nodes: ITtscGraphExpand.INode[];

  /** Handles that resolved to no node, or that were ambiguous. */
  unknown: string[];
}
export namespace ITtscGraphExpand {
  /** Compact final-answer checklist derived from expanded graph facts. */
  export interface IAnswerChecklist {
    /** Short verbatim list to copy into final answers when these facts matter. */
    copyExact: string[];
    /** Exact symbol, alias, type, and parameter identifiers to copy verbatim. */
    exactIdentifiers: string[];
    /** Stable source access aliases, also included in `exactIdentifiers`. */
    aliases?: string[];
    /** Parameter names found in relevant signatures/flow labels. */
    parameters?: string[];
    /** Direct execution dependencies found on expanded nodes. */
    calls?: string[];
    /** String literal values found in relevant signatures or returned source. */
    literals?: string[];
    /** Type names found in signatures, flow labels, and type edges. */
    types?: string[];
    /** Short execution paths worth preserving verbatim. */
    flow?: string[];
    /** File and line ranges for returned source bodies. */
    sourceSpans?: string[];
  }

  /** Which handles to expand, and how much of each to return. */
  export interface IProps {
    /**
     * Node ids from another tool, or dotted symbol handles such as
     * `OrderService.create`. Pass every handle you need for shape-only
     * expansion; with `source:true`, pass only the one or two leaf bodies whose
     * implementation decides the answer.
     */
    handles: string[];

    /**
     * Also list each node's direct dependencies and dependents (the symbols it
     * uses and the symbols that use it). The list is capped; raise
     * `neighborLimit` only when the first slice is not enough.
     *
     * @default false
     */
    neighbors?: boolean;

    /**
     * Maximum dependencies and dependents to return per side when
     * `neighbors:true`. When combined with `source:true`, the server keeps a
     * tiny neighbor slice even if a larger value is requested; split dependency
     * mapping and source reading into separate calls for more context.
     *
     * @default 12
     */
    neighborLimit?: number;

    /**
     * Return the full declaration source body too. Off by default: expand
     * returns a symbol's signature, and a class/interface/namespace's member
     * outline, which is what you usually need and a fraction of the tokens.
     * Turn this on only for the few leaf functions or methods whose actual
     * control-flow logic you must read. Prefer `source:true` without
     * `neighbors:true`; source plus neighbors is intentionally capped to avoid
     * mixing body reads with broad dependency maps.
     *
     * @default false
     */
    source?: boolean;
  }

  /** One expanded node: its declared shape, and on request its source. */
  export interface INode {
    id: string;
    name: string;
    kind: string;
    file: string;
    /** 1-based declaration line, when known. */
    line?: number;
    /** The declaration signature: its first line(s) up to the body. */
    signature?: string;
    /** Decorators written on this declaration, when any. */
    decorators?: ITtscGraphDecorator[];
    /** Assigned implementation span, when source comes from one. */
    implementation?: ITtscGraphEvidence;
    /** Direct execution dependencies in source order, preserving access aliases. */
    calls?: string[];
    /** Short execution paths from this symbol, bounded and source-ordered. */
    flow?: string[];
    /** Direct type dependencies in source order. */
    types?: string[];
    /** String literal values from the signature or returned source. */
    literals?: string[];
    /**
     * For a class, interface, namespace, module, enum, or file: the symbols it
     * contains, each with its own signature: the member outline a consumer
     * reaches for, without the bodies.
     */
    members?: IMember[];
    /**
     * The full declaration source, or the assigned implementation source when
     * `implementation` is present, only when `source` was requested.
     */
    source?: string;
    /** The file and line range covered by `source`, when it was returned. */
    sourceSpan?: Pick<
      ITtscGraphEvidence,
      "file" | "startLine" | "endLine"
    >;
    /** True when `source` was cut at the line cap. */
    truncated?: boolean;
    /** Symbols this node uses (outgoing dependency edges). */
    dependsOn?: IReference[];
    /** Symbols that use this node (incoming dependency edges). */
    dependedOnBy?: IReference[];
  }

  /** One member of a container node, with its signature but not its body. */
  export interface IMember {
    name: string;
    kind: string;
    /** 1-based declaration line, when known. */
    line?: number;
    /** The member's declaration signature. */
    signature?: string;
    /** Decorators written on this member, when any. */
    decorators?: ITtscGraphDecorator[];
  }

  /** A dependency neighbor of an expanded node and the edge that links them. */
  export interface IReference {
    id: string;
    name: string;
    kind: string;
    file: string;
    /** 1-based declaration line, when known. */
    line?: number;
    /** The edge kind connecting the two (`calls`, `type_ref`, ...). */
    relation: string;
    /**
     * Source span for the expression that produced this relationship. It lets
     * an agent see why the edge exists without opening the file. When
     * `source:true` already returned the same source span, `text` may be
     * omitted while the coordinates remain.
     */
    evidence?: ITtscGraphEvidence;
    /**
     * Stable access-path aliases derived from edge evidence. For example, an
     * edge to `Owner.member` through `obj.slot.member` may expose
     * `Owner.slot.member` so answers can preserve both the resolved symbol and
     * the source access path.
     */
    aliases?: string[];
  }
}
