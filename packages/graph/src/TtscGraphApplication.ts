import { TtscGraphMemory } from "./model/TtscGraphMemory";
import { runExpand } from "./server/runExpand";
import { runOverview } from "./server/runOverview";
import { runQuery } from "./server/runQuery";
import { runTrace } from "./server/runTrace";
import { ITtscGraphApplication } from "./structures/ITtscGraphApplication";
import { ITtscGraphExpand } from "./structures/ITtscGraphExpand";
import { ITtscGraphOverview } from "./structures/ITtscGraphOverview";
import { ITtscGraphQuery } from "./structures/ITtscGraphQuery";
import { ITtscGraphTrace } from "./structures/ITtscGraphTrace";

/**
 * The MCP tool surface as a plain class over the resident
 * {@link TtscGraphMemory}.
 *
 * Each public method is one MCP tool — `typia.llm.controller` reflects
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
  public constructor(private readonly graph: TtscGraphMemory) {}

  public graph_overview(props: ITtscGraphOverview.IProps): ITtscGraphOverview {
    return runOverview(this.graph, props);
  }

  public graph_expand(props: ITtscGraphExpand.IProps): ITtscGraphExpand {
    return runExpand(this.graph, props);
  }

  public graph_query(props: ITtscGraphQuery.IProps): ITtscGraphQuery {
    return runQuery(this.graph, props);
  }

  public graph_trace(props: ITtscGraphTrace.IProps): ITtscGraphTrace {
    return runTrace(this.graph, props);
  }
}
