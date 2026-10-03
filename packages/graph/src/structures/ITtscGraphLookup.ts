import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphDocTag } from "./ITtscGraphDocTag";

/**
 * Targeted symbol lookup when a concrete name or handle is being resolved.
 *
 * @evidence contracts/common.md#principled-implementation A literal lookup discriminator and ranked hits represent targeted search while truncation records omitted matches.
 * @evidence contracts/common.md#clear-and-simple-design The envelope carries one collection and its completeness indication, leaving search inputs in the request.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The omission flag prevents a bounded exact-citation match from masquerading as exhaustive coverage.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why truncation matters for documentation targets; member blocks remain separated.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface ITtscGraphLookup {
  /** Discriminator for targeted symbol lookup. */
  type: "lookup";

  /** Ranked symbol matches for the query. */
  hits: ITtscGraphLookup.IHit[];

  /**
   * True when a match was left out by the limit.
   *
   * The audit for the ranked operations already tells a reader that `truncated`
   * marks where more was left out, and this result had no such field — so a cut
   * looked exactly like a complete answer. That is tolerable for a name query,
   * where the ranking is a shortlist by design, and it is not for a
   * documentation target: those hits are an exact match on an address, so a
   * caller asking which code implements a specification is owed the fact that
   * it did not get all of it.
   */
  truncated?: boolean;
}
export namespace ITtscGraphLookup {
  /**
   * Find a concrete class, method, function, property, type, or dotted handle.
   *
   * @evidence contracts/common.md#principled-implementation Query supports symbol search and exact documentation addresses; optional limits and external inclusion express the search boundary.
   * @evidence contracts/common.md#clear-and-simple-design One query owns lookup semantics rather than introducing separate redundant search APIs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Address spelling is supplied by the caller, with no repository-specific citation shortcuts.
   * @evidence contracts/common.md#meaningful-documentation Separate paragraphs describe name lookup, citation lookup, limits and external declarations with their defaults.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
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

  /**
   * One ranked hit with a handle to follow via `details` or `trace`.
   *
   * @evidence contracts/common.md#principled-implementation Resolved coordinates and optional declaration facts ground the hit; relative score describes selection and tags explain citation matches.
   * @evidence contracts/common.md#clear-and-simple-design A compact record combines display facts and follow-up identity without source bodies.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Matching tags are reported as written rather than certified as true or resolved specifications.
   * @evidence contracts/common.md#meaningful-documentation Member comments explain optional tags, one-based lines and relative score separately.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
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
