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
   * Resolve TypeScript code evidence without shell search.
   *
   * Use this for TypeScript code questions, including locating files, symbols,
   * dependencies, implementation bodies, and line anchors. Do not use shell
   * search/read commands to find or verify TypeScript code while this graph can
   * answer with symbols, source bodies, and sourceSpan anchors.
   *
   * Explain the next graph step in `thinking`, then choose one `request.type`:
   * find entrypoints, lookup symbols, trace dependencies, inspect selected
   * symbols, or summarize the project.
   *
   * Keep broad dependency mapping and source-body reads separate. Ask for
   * source only when a selected implementation body decides the answer. Use
   * returned sourceSpan anchors for citations instead of shell line-number
   * checks.
   *
   * @param props The reasoning and selected graph request
   * @returns The selected graph result, tagged with the request type
   */
  inspect_typescript_code_evidence_without_shell_search(
    props: ITtscGraphApplication.IProps,
  ): ITtscGraphApplication.IResult;
}

export namespace ITtscGraphApplication {
  /** Reason first, then submit exactly one graph request. */
  export interface IProps {
    /**
     * Think before choosing the graph operation.
     *
     * State what the code question needs, which graph request is the next
     * smallest step, and why shell search is not needed for that TypeScript
     * evidence. If source is needed, name the one or two leaf bodies to read
     * through the graph and why summaries are not enough. If a package script,
     * config file, or generated artifact is tempting, say why it is outside or
     * inside the user's TypeScript code question.
     */
    thinking: string;

    /** The graph operation chosen from the reasoning above. */
    request:
      | IFindQuestionEntrypoints
      | ILookupSymbols
      | ITraceDependencyPath
      | IInspectSymbolDetails
      | ISummarizeProject;
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
     * @default 8
     */
    limit?: number;

    /**
     * Maximum direct dependencies and dependents to return per indexed symbol.
     *
     * @default 4
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
     * of shell reads or line-number checks.
     */
    purpose: string;

    /** Handles to expand: node ids or dotted symbol handles. */
    handles: string[];

    /**
     * Return direct dependencies and dependents.
     *
     * @default false
     */
    neighbors?: boolean;

    /**
     * Maximum dependencies and dependents per side.
     *
     * @default 6
     */
    neighborLimit?: number;

    /**
     * Return the declaration or implementation source body.
     *
     * @default false
     */
    source?: boolean;
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
