import { TtscGraphMemory } from "./model/TtscGraphMemory";
import { runExpand } from "./server/runExpand";
import { runIndex } from "./server/runIndex";
import { runOverview } from "./server/runOverview";
import { runQuery } from "./server/runQuery";
import { runTrace } from "./server/runTrace";
import { ITtscGraphApplication } from "./structures/ITtscGraphApplication";

export type TtscGraphSource = TtscGraphMemory | (() => TtscGraphMemory);

/**
 * The MCP tool surface as a plain class over the resident
 * {@link TtscGraphMemory}.
 *
 * Its public method is the MCP tool: `typia.llm.controller` reflects
 * {@link ITtscGraphApplication} to generate the tool's JSON schema and argument
 * validator from the signature and JSDoc, with no hand-written schema. The
 * method delegates to the pure graph functions in `./server`, which are
 * unit-testable without a transport; this class only binds them to the graph.
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

  public inspect_typescript_code_evidence_without_shell_search(
    props: ITtscGraphApplication.IProps,
  ): ITtscGraphApplication.IResult {
    const graph = this.graph();
    switch (props.request.type) {
      case "find_question_entrypoints": {
        const { type: _type, purpose: _purpose, ...request } = props.request;
        return {
          type: props.request.type,
          entrypoints: runIndex(graph, request),
        };
      }
      case "lookup_symbols": {
        const { type: _type, purpose: _purpose, ...request } = props.request;
        return {
          type: props.request.type,
          symbols: runQuery(graph, request),
        };
      }
      case "trace_dependency_path": {
        const { type: _type, purpose: _purpose, ...request } = props.request;
        return {
          type: props.request.type,
          trace: runTrace(graph, request),
        };
      }
      case "inspect_symbol_details": {
        const { type: _type, purpose: _purpose, ...request } = props.request;
        return {
          type: props.request.type,
          details: runExpand(graph, request),
        };
      }
      case "summarize_project": {
        const { type: _type, purpose: _purpose, ...request } = props.request;
        return {
          type: props.request.type,
          overview: runOverview(graph, request),
        };
      }
      default:
        throw new Error("Unknown graph request type");
    }
  }
}
