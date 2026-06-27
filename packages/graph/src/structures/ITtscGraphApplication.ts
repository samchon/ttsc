import { ITtscGraphExpand } from "./ITtscGraphExpand";
import { ITtscGraphIndex } from "./ITtscGraphIndex";
import { ITtscGraphOverview } from "./ITtscGraphOverview";
import { ITtscGraphQuery } from "./ITtscGraphQuery";
import { ITtscGraphTrace } from "./ITtscGraphTrace";

/**
 * The MCP tool surface of `@ttsc/graph`, as a typed application.
 *
 * The single method is the single MCP tool. Its parameter object becomes the
 * JSON schema once `typia.llm.controller` reflects this interface.
 * `TtscGraphApplication` implements it over the resident graph.
 */
export interface ITtscGraphApplication {
  /**
   * Inspect the TypeScript project graph before answering code questions.
   *
   * Use this before answering TypeScript codebase questions. It locates files,
   * symbols, dependency paths, implementation bodies, and sourceSpan line
   * anchors from the resident project graph, so answers do not need general
   * framework memory, web documentation, shell search, or file reads for code
   * evidence.
   *
   * Fill the properties in order: restate the question, explain why graph
   * evidence is required, draft the next request type, review that draft, and
   * only then choose one `request.type`: find entrypoints, lookup symbols,
   * trace dependencies, inspect selected symbols, or summarize the project.
   *
   * Keep result slices small. Prefer defaults, and raise `limit`,
   * `neighborLimit`, or `maxNodes` only after a previous graph result was
   * truncated or ambiguous. Keep broad dependency maps and source-body reads in
   * separate calls; ask for `source: true` only for decisive leaf bodies. Use
   * returned sourceSpan anchors instead of shell line-number checks.
   *
   * @param props The reasoning and selected graph request
   * @returns The selected graph result, tagged with the request type
   */
  inspect_typescript_project_graph_before_answering(
    props: ITtscGraphApplication.IProps,
  ): ITtscGraphApplication.IResult;
}

export namespace ITtscGraphApplication {
  /** Think, review, then submit exactly one graph request. */
  export interface IProps {
    /**
     * User's TypeScript code question.
     *
     * Restate the codebase question being answered. Keep this about TypeScript
     * source, symbols, call flow, type flow, or architecture. If the user is
     * asking about scripts, config, generated output, or documentation instead,
     * say that boundary here.
     */
    question: string;

    /**
     * Why the resident graph is the next evidence source.
     *
     * State what graph evidence is needed and why memory, web documentation,
     * shell search, or source file reads are not the next step for this call.
     * Name the smallest evidence that would let the agent stop.
     */
    graphNeed: string;

    /**
     * First request-type decision before arguments are filled.
     *
     * Choose the operation class and explain why it is smaller than the
     * alternatives. This is only the draft; the final arguments are in
     * `request` after `review`.
     */
    draft: IRequestDraft;

    /**
     * Critical review of the draft request.
     *
     * Check whether the draft avoids overfetch, shell fallback, web lookup,
     * broad source reads, and unnecessary neighbor/source combinations. For
     * caller or call-site questions, prefer reverse trace or
     * `inspect_symbol_details` with `neighbors:true`. For exact in-body line
     * anchors, request graph source line numbers. If the draft is wrong, choose
     * the corrected type in `request`.
     */
    review: string;

    /** The graph operation chosen from the reasoning above. */
    request:
      | IFindQuestionEntrypoints
      | ILookupSymbols
      | ITraceDependencyPath
      | IInspectSymbolDetails
      | ISummarizeProject;
  }

  /** First-pass operation choice before final request arguments. */
  export interface IRequestDraft {
    /** Draft discriminator for the intended graph operation. */
    type:
      | "find_question_entrypoints"
      | "lookup_symbols"
      | "trace_dependency_path"
      | "inspect_symbol_details"
      | "summarize_project";

    /** Why this operation type is the smallest useful next step. */
    reason: string;
  }

  /** Find graph starting handles for a natural-language code question. */
  export interface IFindQuestionEntrypoints {
    /** Discriminator for first-pass question indexing. */
    type: "find_question_entrypoints";

    /**
     * Why this is the next step.
     *
     * Use this as the first call for a natural-language TypeScript question. It
     * replaces broad shell search for likely files, symbols, and line anchors.
     */
    purpose: string;

    /** Natural code question or search phrase. */
    query: string;

    /**
     * Maximum ranked hits to return.
     *
     * Keep the default for the first pass. Raise it only when the prior result
     * was truncated or did not contain enough distinct candidates.
     *
     * @default 5
     */
    limit?: number;

    /**
     * Maximum direct dependencies and dependents to return per indexed symbol.
     *
     * This is orientation, not a dump. Keep the default unless the answer needs
     * more direct neighbors from an already chosen symbol.
     *
     * @default 1
     */
    neighbors?: number;
  }

  /** Search indexed TypeScript symbols when a handle is missing. */
  export interface ILookupSymbols {
    /** Discriminator for targeted symbol lookup. */
    type: "lookup_symbols";

    /**
     * Why lookup is the next step.
     *
     * Name the symbol, method, class, property, file concept, or framework term
     * you are trying to locate. Use this when you would otherwise reach for rg
     * to find TypeScript code or exact line anchors. Do not use it for
     * dependency flow.
     */
    purpose: string;

    /** Symbol name, dotted member, or natural-language symbol phrase. */
    query: string;

    /**
     * Maximum hits to return.
     *
     * Keep the default for broad or natural-language lookup. Raise it only
     * after a too-small or ambiguous prior result.
     *
     * @default 12
     */
    limit?: number;
  }

  /** Trace TypeScript call/type/dependency flow between graph handles. */
  export interface ITraceDependencyPath {
    /** Discriminator for dependency tracing. */
    type: "trace_dependency_path";

    /**
     * Why tracing is the next step.
     *
     * State the relationship being tested, such as request flow, render flow,
     * validation flow, "how A reaches B", or "which callers depend on A".
     */
    purpose: string;

    /** Start node id, simple symbol name, or dotted member name. */
    from: string;

    /** Optional target node id, simple symbol name, or dotted member name. */
    to?: string;

    /**
     * Trace direction.
     *
     * @default "forward"
     */
    direction?: "forward" | "reverse" | "impact";

    /**
     * Edge family to follow.
     *
     * @default "all"
     */
    focus?: "all" | "execution" | "types";

    /**
     * Maximum hop depth.
     *
     * @default 6
     */
    maxDepth?: number;

    /**
     * Maximum reached nodes before truncation.
     *
     * Prefer the default for open traces. For "how does A reach B" questions,
     * pass `to` instead of raising this cap.
     *
     * @default 30
     */
    maxNodes?: number;
  }

  /** Inspect selected handles, including sourceSpan bodies when necessary. */
  export interface IInspectSymbolDetails {
    /** Discriminator for selected symbol inspection. */
    type: "inspect_symbol_details";

    /**
     * Why inspection is the next step.
     *
     * Say whether this is shape-only expansion, neighbor mapping, or a narrow
     * graph source read. Source reads should be limited to decisive leaf
     * bodies. Use returned source and sourceSpan anchors for citations instead
     * of shell reads or line-number checks. For caller discovery, use
     * `neighbors:true`; for exact in-body citations, use `lineNumbers:true`.
     */
    purpose: string;

    /** Handles to expand: node ids or dotted symbol handles. */
    handles: string[];

    /**
     * Return direct dependencies and dependents.
     *
     * Use this for a selected symbol's immediate graph context. Do not combine
     * it with `source: true`; source reads intentionally ignore neighbors.
     *
     * @default false
     */
    neighbors?: boolean;

    /**
     * Maximum dependencies and dependents per side.
     *
     * Keep the default unless a prior neighbor slice was truncated or too
     * ambiguous.
     *
     * @default 6
     */
    neighborLimit?: number;

    /**
     * Return the declaration or implementation source body.
     *
     * Use only after a handle is selected and the implementation body is needed
     * to answer. Prefer one or two method/function handles, not containers.
     *
     * @default false
     */
    source?: boolean;

    /**
     * Return numbered source lines with a source read.
     *
     * Use with `source: true` when exact in-body line anchors are needed. This
     * replaces shell `rg`, `cat`, and `Get-Content` line checks. Leave false
     * when the declaration-level sourceSpan is enough.
     *
     * @default false
     */
    lineNumbers?: boolean;
  }

  /** Summarize project-wide graph shape without reading source bodies. */
  export interface ISummarizeProject {
    /** Discriminator for architecture overview. */
    type: "summarize_project";

    /**
     * Why overview is the next step.
     *
     * Use this for architecture orientation, public TypeScript API, layers, and
     * hotspots; not for a specific symbol relationship. For code walk-throughs,
     * choose an exported TypeScript symbol from this result instead of reading
     * package scripts.
     */
    purpose: string;

    /**
     * Which project-wide graph facet to return.
     *
     * @default "all"
     */
    aspect?: "all" | "layers" | "hotspots" | "publicApi";
  }

  /** The selected request's output. Exactly one result field is populated. */
  export interface IResult {
    /** Mirrors `request.type` so the caller can read the matching field. */
    type:
      | "find_question_entrypoints"
      | "lookup_symbols"
      | "trace_dependency_path"
      | "inspect_symbol_details"
      | "summarize_project";

    /** Result for `find_question_entrypoints`. */
    entrypoints?: ITtscGraphIndex;

    /** Result for `lookup_symbols`. */
    symbols?: ITtscGraphQuery;

    /** Result for `trace_dependency_path`. */
    trace?: ITtscGraphTrace;

    /** Result for `inspect_symbol_details`. */
    details?: ITtscGraphExpand;

    /** Result for `summarize_project`. */
    overview?: ITtscGraphOverview;
  }
}
