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
   * A compact architecture map of the project: how big it is, how it is layered
   * by folder, the symbols the most code depends on, and the public API
   * surface. Call this first on an unfamiliar codebase — it names concrete
   * files and symbols for every claim, with no source read.
   *
   * @param props Which facet to project
   * @returns The requested architecture facets
   */
  graph_overview(props: ITtscGraphOverview.IProps): ITtscGraphOverview;

  /**
   * Read the declaration source of nodes another tool returned as handles, plus
   * their direct dependencies and dependents on request. This is how you read
   * code the graph has already located — pass every handle you need in one call
   * instead of opening files.
   *
   * @param props The handles to expand
   * @returns The resolved nodes with source, and any handles that did not
   *   resolve
   */
  graph_expand(props: ITtscGraphExpand.IProps): ITtscGraphExpand;

  /**
   * Find the symbols and clusters most relevant to a natural query, even when
   * you do not know the exact name. Mix code vocabulary and plain words;
   * matches rank by exact and dotted names, CamelCase/subword overlap, file
   * path, and how central the symbol is. Returns handles to follow with
   * `graph_expand` or `graph_trace`.
   *
   * @param props The query and result cap
   * @returns Ranked hits with handles
   */
  graph_query(props: ITtscGraphQuery.IProps): ITtscGraphQuery;

  /**
   * Trace dependency flow from a symbol: `forward` to what it uses, `reverse`
   * to what uses it, or `impact` to the public API and tests a change would
   * reach. Follows real call/type edges only — structural and heuristic edges
   * are excluded — and returns ordered hops with handles.
   *
   * @param props The start, direction, and bounds
   * @returns The ordered hops and reached nodes, or candidates for an ambiguous
   *   start
   */
  graph_trace(props: ITtscGraphTrace.IProps): ITtscGraphTrace;
}
