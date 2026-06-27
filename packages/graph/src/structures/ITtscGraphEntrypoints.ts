import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphEvidence } from "./ITtscGraphEvidence";

/** The compact source-free entrypoint list returned for a code question. */
export interface ITtscGraphEntrypoints {
  /** Discriminator for first-pass question indexing. */
  type: "entrypoints";

  /** The original question/search phrase the entrypoints were built for. */
  query: string;

  /** Ranked symbols relevant to the query. */
  hits: ITtscGraphEntrypoints.IHit[];

  /** Code handles written directly in the query, resolved when possible. */
  mentions: ITtscGraphEntrypoints.IMention[];

  /** Direct dependency context for the resolved mentions and highest hits. */
  neighborhood: ITtscGraphEntrypoints.INeighborhood[];

  /** Follow-up handles for deeper graph calls. */
  next: ITtscGraphEntrypoints.INext;

  /** True when result caps hid additional seeds or references. */
  truncated?: boolean;
}

export namespace ITtscGraphEntrypoints {
  /**
   * Ask the graph for the first entrypoints an agent should read before opening
   * source: ranked symbols, exact mentioned handles, and nearby dependency
   * edges.
   */
  export interface IRequest {
    /** Discriminator for first-pass question indexing. */
    type: "entrypoints";

    /**
     * A natural code question or search phrase. Mix prose with code handles,
     * for example `how Repository.find loads relations` or
     * `SelectQueryBuilder.setFindOptions join aliases`.
     */
    query: string;

    /**
     * Maximum ranked hits to return.
     *
     * @default 5
     */
    limit?: number;

    /**
     * Maximum direct dependencies and dependents to return per indexed symbol.
     * This is an orientation slice, not a dependency dump; use `trace` or
     * `details` with `neighbors:true` after choosing the specific handles.
     *
     * @default 1
     */
    neighbors?: number;
  }

  /** A compact symbol coordinate, optionally with its declaration signature. */
  export interface INode {
    id: string;
    name: string;
    kind: string;
    file: string;
    /** 1-based declaration line, when known. */
    line?: number;
    /** Declaration head, included only for indexed symbols. */
    signature?: string;
    /** Decorators written on this declaration, when any. */
    decorators?: ITtscGraphDecorator[];
  }

  /** One ranked search hit. */
  export interface IHit extends INode {
    /** Relative relevance; higher is a better match. */
    score: number;
  }

  /** A code handle written in the query, with its resolution status. */
  export interface IMention {
    handle: string;
    node?: INode;
    candidates?: INode[];
  }

  /** Direct dependency context around one indexed symbol. */
  export interface INeighborhood extends INode {
    dependsOn: IReference[];
    dependedOnBy: IReference[];
  }

  /** One neighboring symbol and the relationship leading to it. */
  export interface IReference {
    id: string;
    name: string;
    kind: string;
    file: string;
    /** 1-based declaration line, when known. */
    line?: number;
    relation: string;
    /**
     * Source span for the expression that produced this relationship. It lets
     * an agent see why the edge exists without opening the file.
     */
    evidence?: ITtscGraphEvidence;
  }

  /** Tool-call handles suggested by this first entrypoints result. */
  export interface INext {
    /** Pass these ids to `details`, with `source: true` only when needed. */
    details: string[];
    /** Pass these ids to `trace` when following dependency flow. */
    traceFrom: string[];
  }
}
