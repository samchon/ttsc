import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphDocTag } from "./ITtscGraphDocTag";

/** Targeted symbol lookup when a concrete name or handle is being resolved. */
export interface ITtscGraphLookup {
  /** Discriminator for targeted symbol lookup. */
  type: "lookup";

  /** Ranked symbol matches for the query. */
  hits: ITtscGraphLookup.IHit[];
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
