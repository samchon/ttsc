import { TtscGraphMemory } from "./model/TtscGraphMemory";
import { runExpand } from "./server/runExpand";
import { runIndex } from "./server/runIndex";
import { runOverview } from "./server/runOverview";
import { runQuery } from "./server/runQuery";
import { runTrace } from "./server/runTrace";
import { ITtscGraphApplication } from "./structures/ITtscGraphApplication";
import { ITtscGraphExpand } from "./structures/ITtscGraphExpand";
import { ITtscGraphIndex } from "./structures/ITtscGraphIndex";
import { ITtscGraphOverview } from "./structures/ITtscGraphOverview";
import { ITtscGraphQuery } from "./structures/ITtscGraphQuery";
import { ITtscGraphTrace } from "./structures/ITtscGraphTrace";

export type TtscGraphSource = TtscGraphMemory | (() => TtscGraphMemory);

/**
 * The MCP tool surface as a plain class over the resident
 * {@link TtscGraphMemory}.
 *
 * Each public method is one MCP tool: `typia.llm.controller` reflects
 * {@link ITtscGraphApplication} to generate every tool's JSON schema and
 * argument validator from these signatures and their JSDoc, with no
 * hand-written schema. The methods delegate to the pure tool functions in
 * `./server`, which are unit-testable without a transport; this class only
 * binds them to the graph.
 *
 * Every method answers from the resident graph; none recompiles. Output is kept
 * compact and bounded so a model can read structure without a file read, which
 * is the token win the redesign exists for.
 */
export class TtscGraphApplication implements ITtscGraphApplication {
  private readonly graph: () => TtscGraphMemory;

  public constructor(source: TtscGraphSource) {
    this.graph = typeof source === "function" ? source : () => source;
  }

  public question_entrypoints(
    props: ITtscGraphIndex.IProps,
  ): ITtscGraphIndex {
    return runIndex(this.graph(), props);
  }

  public dependency_path(
    props: ITtscGraphTrace.IProps,
  ): ITtscGraphTrace {
    return runTrace(this.graph(), props);
  }

  public symbol_details(
    props: ITtscGraphExpand.IProps,
  ): ITtscGraphExpand {
    return runExpand(this.graph(), props);
  }

  public symbol_lookup(props: ITtscGraphQuery.IProps): ITtscGraphQuery {
    return runQuery(this.graph(), props);
  }

  public project_overview(
    props: ITtscGraphOverview.IProps,
  ): ITtscGraphOverview {
    return runOverview(this.graph(), props);
  }
}
