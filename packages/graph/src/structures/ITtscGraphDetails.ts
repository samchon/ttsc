import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphEvidence } from "./ITtscGraphEvidence";
import { ITtscGraphNext } from "./ITtscGraphNext";

/**
 * The source-free facts for a few selected handles.
 *
 * This is not a file reader. It returns signatures, member outlines, direct
 * calls, direct types, implementation candidates, dependency summaries, and
 * sourceSpan citation anchors.
 */
export interface ITtscGraphDetails {
  /** Discriminator for selected symbol inspection. */
  type: "details";

  /** Selected node facts, in the same order as resolved handles when possible. */
  nodes: ITtscGraphDetails.INode[];

  /** How to use this source-free result next. */
  next: ITtscGraphNext;

  /** Human-readable compatibility note mirroring `next`. */
  guide: string;

  /** Handles that resolved to no node, or that were ambiguous. */
  unknown: string[];
}
export namespace ITtscGraphDetails {
  /** Which selected handles to inspect, and how much of each to return. */
  export interface IRequest {
    /** Discriminator for selected symbol inspection. */
    type: "details";

    /**
     * Node ids from another tool, or dotted symbol handles such as
     * `OrderService.create`. Pass the few handles you need for source-free
     * details. Prefer one to three handles. Use `trace` when you need a path
     * instead of widening this call.
     */
    handles: string[];

    /**
     * Also list each node's direct dependencies and dependents (the symbols it
     * uses and the symbols that use it). The list is capped; raise
     * `neighborLimit` when the first slice is truncated and the missing
     * relation is named. This remains a relationship summary, not a file body.
     *
     * @default false
     */
    neighbors?: boolean;

    /**
     * Maximum dependencies and dependents to return per side when
     * `neighbors:true`.
     *
     * Prefer the default. Values above a few neighbors are usually overfetch;
     * call `trace` for flow instead.
     *
     * @default 2
     */
    neighborLimit?: number;

    /**
     * Maximum owned members to return for a container or object literal. Raise
     * only when the first outline is truncated and the missing member is
     * named.
     *
     * @default 6
     */
    memberLimit?: number;

    /**
     * Maximum direct execution and type references to return per group. Raise
     * only when the first dependency slice is truncated and the missing
     * dependency is named.
     *
     * @default 1
     */
    dependencyLimit?: number;

    /**
     * Include dependency-boundary references from node_modules or bundled
     * `.d.ts` libraries. Leave false for source-architecture answers; enable
     * only when external type/API boundaries are the question.
     *
     * @default false
     */
    includeExternal?: boolean;
  }

  /** One inspected node: its declared shape and graph coordinates. */
  export interface INode {
    /** Stable node id for subsequent `details` or `trace` calls. */
    id: string;

    /** Qualified symbol name when available, otherwise the simple name. */
    name: string;

    /** Declaration kind (`class`, `method`, `function`, ...). */
    kind: string;

    /** Project-relative path of the file that declares this node. */
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

    /** Concrete nodes that implement or override this interface/base member. */
    implementedBy?: IReference[];

    /** String literal values from the signature. */
    literals?: string[];

    /**
     * For a container or object-literal variable: the owned symbol or top-level
     * property outline a consumer reaches for, without bodies.
     */
    members?: IMember[];

    /** Declaration or implementation citation range, when known. */
    sourceSpan?: Pick<ITtscGraphEvidence, "file" | "startLine" | "endLine">;

    /** Symbols this node uses (outgoing dependency edges). */
    dependsOn?: IReference[];

    /** Symbols that use this node (incoming dependency edges). */
    dependedOnBy?: IReference[];
  }

  /** One member of a container node, with its signature but not its body. */
  export interface IMember {
    /** Member name, qualified when the graph records an owner-qualified handle. */
    name: string;

    /** Member kind (`method`, `property`, `class`, ...). */
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
    /** Stable id of the neighboring node. */
    id: string;

    /** Neighbor symbol name, qualified when available. */
    name: string;

    /** Neighbor declaration kind. */
    kind: string;

    /** Project-relative declaration file for the neighbor. */
    file: string;

    /** 1-based declaration line, when known. */
    line?: number;

    /** The edge kind connecting the two (`calls`, `type_ref`, ...). */
    relation: string;

    /**
     * Source span for the expression that produced this relationship. It is
     * repository evidence for the edge, not a file-read instruction.
     */
    evidence?: ITtscGraphEvidence;
  }
}
