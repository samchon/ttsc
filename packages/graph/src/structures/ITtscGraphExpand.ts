/**
 * The resolved nodes the `graph_expand` tool returns for a set of handles —
 * their declared shape (signature, and a container's members), and only on
 * request their full source body.
 */
export interface ITtscGraphExpand {
  nodes: ITtscGraphExpand.INode[];

  /** Handles that resolved to no node. */
  unknown: string[];
}
export namespace ITtscGraphExpand {
  /** Which handles to expand, and how much of each to return. */
  export interface IProps {
    /**
     * Node ids to expand, exactly as another tool returned them. Pass every
     * handle you need in one call.
     */
    handles: string[];

    /**
     * Also list each node's direct dependencies and dependents (the symbols it
     * uses and the symbols that use it).
     *
     * @default false
     */
    neighbors?: boolean;

    /**
     * Return the full declaration source body too. Off by default: expand
     * returns the declared shape — a symbol's signature, and a class/interface/
     * namespace's member outline — which is what you usually need and a fraction
     * of the tokens. Turn this on only for the few leaf functions or methods
     * whose actual control-flow logic you must read.
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
    /** The declaration signature — its first line(s) up to the body. */
    signature?: string;
    /**
     * For a class, interface, namespace, module, enum, or file: the symbols it
     * contains, each with its own signature — the member outline a consumer
     * reaches for, without the bodies.
     */
    members?: IMember[];
    /** The full declaration source — only when `source` was requested. */
    source?: string;
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
  }

  /** A dependency neighbor of an expanded node and the edge that links them. */
  export interface IReference {
    id: string;
    name: string;
    kind: string;
    /** The edge kind connecting the two (`calls`, `type_ref`, …). */
    relation: string;
  }
}
