import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphNext } from "./ITtscGraphNext";

/** Targeted symbol lookup when a concrete name or handle is being resolved. */
export interface ITtscGraphLookup {
  /** Discriminator for targeted symbol lookup. */
  type: "lookup";

  /** Ranked symbol matches for the query. */
  hits: ITtscGraphLookup.IHit[];

  /** How to use this source-free result next. */
  next: ITtscGraphNext;

  /** Human-readable compatibility note mirroring `next`. */
  guide: string;
}
export namespace ITtscGraphLookup {
  /** Find a concrete class, method, function, property, type, or dotted handle. */
  export interface IRequest {
    /** Discriminator for targeted symbol lookup. */
    type: "lookup";

    /**
     * What to find, in natural language and code vocabulary mixed freely: a
     * symbol name, a dotted member (`Service.create`), or a short phrase
     * (`request handler`). Exact names are not required, but this is not a
     * second broad entrypoints call. Use it when a named handle is missing or
     * ambiguous.
     */
    query: string;

    /**
     * Maximum hits to return.
     *
     * Prefer the default. Large hit lists usually mean the query is too broad;
     * refine the name instead of raising this.
     *
     * @default 5
     */
    limit?: number;
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
}
