import { ITtscGraphDecorator } from "./ITtscGraphDecorator";

/** The ranked hits returned by targeted symbol lookup. */
export interface ITtscGraphLookup {
  /** Discriminator for targeted symbol lookup. */
  type: "lookup";

  hits: ITtscGraphLookup.IHit[];

  /** Follow-up handles for source or member details. */
  next: ITtscGraphLookup.INext;
}
export namespace ITtscGraphLookup {
  /** Find the symbols and clusters most relevant to a natural code query. */
  export interface IRequest {
    /** Discriminator for targeted symbol lookup. */
    type: "lookup";

    /**
     * What to find, in natural language and code vocabulary mixed freely: a
     * symbol name, a dotted member (`OrderService.create`), or a phrase
     * (`shopping order create`, `repository find relations`). Exact names are
     * not required; subword and CamelCase matches rank too.
     */
    query: string;

    /**
     * Maximum hits to return.
     *
     * @default 12
     */
    limit?: number;
  }

  /** One ranked hit with a handle to follow via `details` or `trace`. */
  export interface IHit {
    id: string;
    name: string;
    kind: string;
    file: string;
    /** 1-based declaration line, when known. */
    line?: number;
    /**
     * The hit's declaration signature, so you can often answer without
     * requesting details.
     */
    signature?: string;
    /** Decorators written on this declaration, when any. */
    decorators?: ITtscGraphDecorator[];
    /** Relative relevance; higher is a better match. */
    score: number;
  }

  /** Tool-call handles suggested by this lookup result. */
  export interface INext {
    /** Pass these ids to `details`, with `source: true` only when needed. */
    details: string[];
    /** Pass these ids to `trace` when following dependency flow. */
    traceFrom: string[];
  }
}
