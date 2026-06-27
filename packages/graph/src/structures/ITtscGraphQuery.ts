import { ITtscGraphDecorator } from "./ITtscGraphDecorator";

/** The ranked hits returned by targeted symbol lookup. */
export interface ITtscGraphQuery {
  hits: ITtscGraphQuery.IHit[];

  /** Follow-up handles for source or member details. */
  next: ITtscGraphQuery.INext;
}
export namespace ITtscGraphQuery {
  /** Find the symbols and clusters most relevant to a natural code query. */
  export interface IProps {
    /**
     * What to find, in natural language and code vocabulary mixed freely — a
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

  /** One ranked hit with a handle to follow via `symbol_details` or `dependency_path`. */
  export interface IHit {
    id: string;
    name: string;
    kind: string;
    file: string;
    /** 1-based declaration line, when known. */
    line?: number;
    /**
     * The hit's declaration signature, so you can often answer without
     * expanding.
     */
    signature?: string;
    /** Decorators written on this declaration, when any. */
    decorators?: ITtscGraphDecorator[];
    /** Relative relevance; higher is a better match. */
    score: number;
  }

  /** Tool-call handles suggested by this index result. */
  export interface INext {
    /** Pass these ids to `symbol_details`, with `source: true` only when needed. */
    expand: string[];
    /** Pass these ids to `dependency_path` when following dependency flow. */
    traceFrom: string[];
  }
}
