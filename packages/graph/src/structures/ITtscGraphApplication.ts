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
   * Plan and run one TypeScript graph operation.
   *
   * Use this before shell-reading TypeScript source. First explain the next
   * graph step in `thinking`, then choose one `request.type`: find entrypoints,
   * lookup symbols, trace dependencies, inspect selected symbols, or summarize
   * the project.
   *
   * Keep broad dependency mapping and source-body reads separate. Ask for
   * source only when a selected implementation body decides the answer.
   *
   * @param props The reasoning and selected graph request
   * @returns The selected graph result, tagged with the request type
   */
  query_typescript_graph(
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
     * smallest step, and whether source is needed now. If source is needed,
     * name the one or two leaf bodies to read and why graph summaries are not
     * enough.
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

  /** Find source-free starting handles for a natural-language code question. */
  export interface IFindQuestionEntrypoints {
    /** Discriminator for first-pass question indexing. */
    type: "find_question_entrypoints";

    /**
     * Why this is the next step.
     *
     * Use this when you need ranked starting symbols or direct mention
     * resolution before tracing or inspecting.
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

  /** Search for specific named symbols when a handle is missing. */
  export interface ILookupSymbols {
    /** Discriminator for targeted symbol lookup. */
    type: "lookup_symbols";

    /**
     * Why lookup is the next step.
     *
     * Name the symbol, method, class, property, or concept you are trying to
     * locate. Do not use this for dependency flow.
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

  /** Trace call/type/dependency flow from one symbol, optionally to a target. */
  export interface ITraceDependencyPath {
    /** Discriminator for dependency tracing. */
    type: "trace_dependency_path";

    /**
     * Why tracing is the next step.
     *
     * State the relationship being tested, such as "how A reaches B" or "which
     * callers depend on A".
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

  /** Inspect selected handles, with source bodies only when necessary. */
  export interface IInspectSymbolDetails {
    /** Discriminator for selected symbol inspection. */
    type: "inspect_symbol_details";

    /**
     * Why inspection is the next step.
     *
     * Say whether this is shape-only expansion, neighbor mapping, or a narrow
     * source read. Source reads should be limited to decisive leaf bodies.
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
     * Use this for architecture orientation, public API, layers, and hotspots;
     * not for a specific symbol relationship.
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
