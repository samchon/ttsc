import { ITtscGraphExpand } from "./ITtscGraphExpand";
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
   * The project's architecture — folder layers, dependency hotspots, and the
   * public API. Call first to orient on an unfamiliar codebase.
   *
   * @param props Which facet to project
   * @returns The requested architecture facets
   */
  graph_overview(props: ITtscGraphOverview.IProps): ITtscGraphOverview;

  /**
   * The declared shape of the given symbols: each one's signature, and for a
   * class/interface/namespace its members. Set `source: true` to also read a
   * specific body, `neighbors: true` to list what it uses and what uses it.
   *
   * @param props The handles to expand
   * @returns The resolved nodes, and any handles that did not resolve
   */
  graph_expand(props: ITtscGraphExpand.IProps): ITtscGraphExpand;

  /**
   * Find any symbol — class, function, method, or field — by name or
   * description. Each hit comes with its signature, so the query alone often
   * answers the question.
   *
   * @param props The query and result cap
   * @returns Ranked hits with handles
   */
  graph_query(props: ITtscGraphQuery.IProps): ITtscGraphQuery;

  /**
   * Follow dependency flow from a symbol: `forward` to what it uses, `reverse` to
   * what uses it, or `impact` to the public API and tests a change reaches.
   *
   * @param props The start, direction, and bounds
   * @returns The ordered hops and reached nodes, or candidates for an ambiguous
   *   start
   */
  graph_trace(props: ITtscGraphTrace.IProps): ITtscGraphTrace;
}
