import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphEvidence } from "./ITtscGraphEvidence";

/**
 * The resolved symbol details returned for a set of handles.
 *
 * The default payload is source-free: signatures, member outlines, and direct
 * graph summaries with sourceSpan anchors.
 */
export interface ITtscGraphDetails {
  /** Discriminator for selected symbol inspection. */
  type: "details";

  nodes: ITtscGraphDetails.INode[];

  /** Handles that resolved to no node, or that were ambiguous. */
  unknown: string[];
}
export namespace ITtscGraphDetails {
  /** Which handles to inspect, and how much of each to return. */
  export interface IRequest {
    /** Discriminator for selected symbol inspection. */
    type: "details";

    /**
     * Node ids from another tool, or dotted symbol handles such as
     * `OrderService.create`. Pass the few handles you need for source-free
     * details; use `trace` when you need a path instead of widening this call.
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
     * `neighbors:true`.
     *
     * @default 6
     */
    neighborLimit?: number;

    /**
     * Maximum owned members to return for a container or object literal. Raise
     * only when the first outline is truncated.
     *
     * @default 12
     */
    memberLimit?: number;

    /**
     * Maximum direct execution and type references to return per group. Raise
     * only when the first dependency slice is not enough.
     *
     * @default 3
     */
    dependencyLimit?: number;
  }

  /** One inspected node: its declared shape and graph coordinates. */
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
    /** Direct execution dependencies in source order, with edge evidence. */
    calls?: IReference[];
    /** Direct type dependencies in source order, with edge evidence. */
    types?: IReference[];
    /** String literal values from the signature. */
    literals?: string[];
    /**
     * For a container or object-literal variable: the owned symbol or top-level
     * property outline a consumer reaches for, without bodies.
     */
    members?: IMember[];
    /** The declaration or implementation file and line range, when known. */
    sourceSpan?: Pick<ITtscGraphEvidence, "file" | "startLine" | "endLine">;
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

  /** A dependency neighbor of an inspected node and the edge that links them. */
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
     * an agent see why the edge exists without opening the file.
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
