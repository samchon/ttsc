import { TtscGraphMemory } from "./model/TtscGraphMemory";
import { RESULT_DIRECTIVE } from "./server/resultDirective";
import { resultGuide, resultNext } from "./server/resultGuide";
import { runDetails } from "./server/runDetails";
import { runEntrypoints } from "./server/runEntrypoints";
import { runLookup } from "./server/runLookup";
import { runOverview } from "./server/runOverview";
import { runTour } from "./server/runTour";
import { runTrace } from "./server/runTrace";
import { ITtscGraphApplication } from "./structures/ITtscGraphApplication";
import { ITtscGraphEscape } from "./structures/ITtscGraphEscape";

export type TtscGraphSource =
  | TtscGraphMemory
  | (() => TtscGraphMemory | Promise<TtscGraphMemory>);

/**
 * The MCP tool surface as a plain class over the resident
 * {@link TtscGraphMemory}.
 *
 * Its public method is the MCP tool: `typia.llm.application` reflects
 * {@link ITtscGraphApplication} to generate the tool's JSON schema and argument
 * validator from the signature and JSDoc, with no hand-written schema, and
 * `@typia/mcp`'s `createMcpServer` registers it (see `./server/createServer`).
 * The method delegates to the pure graph functions in `./server`, which are
 * unit-testable without a transport; this class only binds them to the graph.
 *
 * Every method answers from the current resident graph. The source may refresh
 * that graph before the operation when project files changed. Output is kept
 * compact and bounded so a model can read structure without a file read, which
 * is the token win the redesign exists for.
 */
export class TtscGraphApplication implements ITtscGraphApplication {
  private readonly graph: () => TtscGraphMemory | Promise<TtscGraphMemory>;

  public constructor(source: TtscGraphSource) {
    this.graph = typeof source === "function" ? source : () => source;
  }

  public async inspect_typescript_graph(
    props: ITtscGraphApplication.IProps,
  ): Promise<ITtscGraphApplication.IResult> {
    if (props.request.type === "escape") {
      const result = this.escape(props.request.reason);
      if (props.request.nextStep !== undefined) {
        result.nextStep = props.request.nextStep;
      }
      return {
        directive: RESULT_DIRECTIVE,
        result,
      };
    }
    const graph = await this.graph();
    switch (props.request.type) {
      case "entrypoints":
        return {
          directive: RESULT_DIRECTIVE,
          result: runEntrypoints(graph, props.request),
        };
      case "lookup":
        return {
          directive: RESULT_DIRECTIVE,
          result: runLookup(graph, props.request),
        };
      case "trace":
        return {
          directive: RESULT_DIRECTIVE,
          result: runTrace(graph, props.request),
        };
      case "details":
        return {
          directive: RESULT_DIRECTIVE,
          result: runDetails(graph, props.request),
        };
      case "overview":
        return {
          directive: RESULT_DIRECTIVE,
          result: runOverview(graph, props.request),
        };
      case "tour":
        return {
          directive: RESULT_DIRECTIVE,
          result: runTour(graph, props.request),
        };
      default:
        props.request satisfies never;
        throw new Error("Unknown graph request type");
    }
  }

  private escape(
    reason: string,
    nextStep?: string,
    action: "answer" | "outside" | "clarify" = "outside",
  ): ITtscGraphEscape {
    return {
      type: "escape",
      skipped: true,
      reason,
      next: resultNext(
        action,
        nextStep ??
          "Graph evidence is exhausted or not the next evidence source.",
      ),
      guide: resultGuide(
        "Finish from existing graph evidence, state the graph gap, or ask for clarification.",
      ),
      ...(nextStep !== undefined ? { nextStep } : {}),
    };
  }
}
