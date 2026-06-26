/** The ranked hits the `graph_query` tool returns for a natural code query. */
export interface ITtscGraphQuery {
  hits: ITtscGraphQuery.IHit[];
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

  /** One ranked hit with a handle to follow via `graph_expand` or `graph_trace`. */
  export interface IHit {
    id: string;
    name: string;
    kind: string;
    file: string;
    /** 1-based declaration line, when known. */
    line?: number;
    /** The hit's declaration signature, so you can often answer without expanding. */
    signature?: string;
    /** Relative relevance; higher is a better match. */
    score: number;
  }
}
