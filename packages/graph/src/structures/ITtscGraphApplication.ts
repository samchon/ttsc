import { ITtscGraphExpand } from "./ITtscGraphExpand";
import { ITtscGraphIndex } from "./ITtscGraphIndex";
import { ITtscGraphOverview } from "./ITtscGraphOverview";
import { ITtscGraphQuery } from "./ITtscGraphQuery";
import { ITtscGraphTrace } from "./ITtscGraphTrace";

/**
 * The MCP tool surface of `@ttsc/graph`, as a typed application.
 *
 * Each method is one MCP tool; its name is the tool name and its parameter
 * object becomes the tool's JSON schema once `typia.llm.controller` reflects
 * this interface. `TtscGraphApplication` implements it over the resident
 * graph.
 */
export interface ITtscGraphApplication {
  /**
   * Locate the best starting symbols for a natural-language code question.
   *
   * Use this once at the start of a source-flow question. It returns ranked
   * symbols, directly mentioned handles, signatures, decorators, and a small
   * dependency orientation slice without source bodies.
   *
   * Follow with `dependency_path` for call/type flow or `symbol_details` for
   * selected declarations.
   *
   * @param props The natural code question or search phrase
   * @returns Compact graph coordinates and dependency context
   */
  question_entrypoints(props: ITtscGraphIndex.IProps): ITtscGraphIndex;

  /**
   * Trace dependency flow between or away from symbols.
   *
   * Use `from` and optional `to` for call paths such as "how A reaches B".
   * `focus:"execution"` follows runtime edges; `focus:"types"` follows type
   * and inheritance edges.
   *
   * Hops carry evidence and aliases. Path results include compact `steps`, so
   * many flow questions do not need source expansion.
   *
   * @param props The start, optional target, direction, and bounds
   * @returns The ordered hops and reached nodes, or candidates for an ambiguous
   *   start
   */
  dependency_path(props: ITtscGraphTrace.IProps): ITtscGraphTrace;

  /**
   * Inspect selected symbols and optionally read their bodies.
   *
   * Use multiple handles for shape-only expansion: signatures, members,
   * decorators, direct calls, direct types, and bounded dependency neighbors.
   *
   * Use `source:true` only for the one or two leaf bodies whose implementation
   * decides the answer. Use `neighbors:true` without source for dependency
   * mapping; source mode ignores neighbor expansion.
   *
   * @param props The handles to expand
   * @returns The resolved nodes, and any handles that did not resolve
   */
  symbol_details(props: ITtscGraphExpand.IProps): ITtscGraphExpand;

  /**
   * Find specific symbols by name or description.
   *
   * Use this when you need a class, function, method, property, or type and do
   * not already have its handle. It is targeted lookup, not flow tracing.
   *
   * Follow with `dependency_path` for relationships or `symbol_details` for
   * declarations and source bodies.
   *
   * @param props The query and result cap
   * @returns Ranked hits with handles
   */
  symbol_lookup(props: ITtscGraphQuery.IProps): ITtscGraphQuery;

  /**
   * Summarize the project-wide graph shape.
   *
   * Use this for architecture orientation: folder layers, dependency hotspots,
   * and public API handles. It is not a symbol search or source reader.
   *
   * @param props Which facet to project
   * @returns The requested architecture facets
   */
  project_overview(props: ITtscGraphOverview.IProps): ITtscGraphOverview;
}
