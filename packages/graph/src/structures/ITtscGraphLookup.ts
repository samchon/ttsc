import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphDocTag } from "./ITtscGraphDocTag";

/** Targeted symbol lookup when a concrete name or handle is being resolved. */
export interface ITtscGraphLookup {
  /** Discriminator for targeted symbol lookup. */
  type: "lookup";

  /** Ranked symbol matches for the query. */
  hits: ITtscGraphLookup.IHit[];

  /**
   * True when a match was left out by the limit.
   *
   * The audit for the ranked operations already tells a reader that
   * `truncated` marks where more was left out, and this result had no such
   * field — so a cut looked exactly like a complete answer. That is tolerable
   * for a name query, where the ranking is a shortlist by design, and it is not
   * for a documentation target: those hits are an exact match on an address, so
   * a caller asking which code implements a specification is owed the fact that
   * it did not get all of it.
   */
  truncated?: boolean;
}
export namespace ITtscGraphLookup {
  /** Find a concrete class, method, function, property, type, or dotted handle. */
  export interface IRequest {
    /** Discriminator for targeted symbol lookup. */
    type: "lookup";

    /**
     * What to find: a symbol name, a dotted member (`Service.create`), or a
     * short phrase (`request handler`). Exact names are not required, but this
     * is not a second broad entrypoints call; use it for a missing or ambiguous
     * named handle.
     *
     * It also answers the other direction. Give it a documentation target — a
     * document section (`docs/pricing.md#sale`), an API operation
     * (`POST:/orders`), a data model (`prisma:Sale`) — and the hits are the
     * declarations whose documentation cites it, each carrying the tag that
     * matched. That is the question a repository-wide search would otherwise
     * answer, so it is worth asking here first; a target is matched exactly, so
     * spell it as the code does.
     */
    query: string;

    /**
     * Maximum hits to return. A large hit list usually means the query is too
     * broad; refine the name instead of raising this.
     *
     * @default 5
     */
    limit?: number;

    /**
     * Include dependency-boundary declarations from node_modules or bundled
     * `.d.ts` libraries. Enable only when external type/API boundaries are the
     * question.
     *
     * @default false
     */
    includeExternal?: boolean;
  }

  /** One ranked hit with a handle to follow via `details` or `trace`. */
  export interface IHit {
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

    /** Declaration signature, often enough to answer without a `details` call. */
    signature?: string;

    /** Decorators written on this declaration, when any. */
    decorators?: ITtscGraphDecorator[];

    /**
     * The documentation tags that matched the query, when the query named one.
     *
     * Present only on a hit found through its tags, so it says why this
     * declaration is here: the query named a specification and this is the code
     * that answers to it. A hit matched by name carries none.
     */
    docTags?: ITtscGraphDocTag[];

    /** Relative relevance; higher is a better match. */
    score: number;
  }
}
