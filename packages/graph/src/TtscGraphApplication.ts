import { TtscGraphMemory } from "./model/TtscGraphMemory";
import { RESULT_AUDIT, RESULT_AUDIT_ESCAPE } from "./server/resultAudit";
import { resultNext } from "./server/resultNext";
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
  ): Promise<ITtscGraphApplication.IOutput> {
    if (props.request.type === "escape") {
      const result = this.escape(props.request.reason);
      if (props.request.nextStep !== undefined) {
        result.nextStep = props.request.nextStep;
      }
      return {
        audit: RESULT_AUDIT_ESCAPE,
        next: resultNext(
          "outside",
          "The caller chose to leave the graph, so this call carries no graph facts.",
        ),
        result,
      };
    }
    const graph = await this.graph();
    switch (props.request.type) {
      case "entrypoints": {
        const r = runEntrypoints(graph, props.request);
        return {
          audit: RESULT_AUDIT,
          next: r.next,
          result: r.result,
        };
      }
      case "lookup": {
        const r = runLookup(graph, props.request);
        return {
          audit: RESULT_AUDIT,
          next: r.next,
          result: r.result,
        };
      }
      case "trace": {
        const r = runTrace(graph, props.request);
        return {
          audit: RESULT_AUDIT,
          next: r.next,
          result: r.result,
        };
      }
      case "details": {
        const r = runDetails(graph, props.request);
        return {
          audit: RESULT_AUDIT,
          next: r.next,
          result: r.result,
        };
      }
      case "overview": {
        const r = runOverview(graph, props.request);
        return {
          audit: RESULT_AUDIT,
          next: r.next,
          result: r.result,
        };
      }
      case "tour": {
        // The tour ranks against the question, and the question is `props`
        // — the caller wrote it once, at the top, in the user's words.
        const r = runTour(graph, props.request, props.question);
        return {
          audit: RESULT_AUDIT,
          next: r.next,
          result: r.result,
        };
      }
      default:
        props.request satisfies never;
        throw new Error("Unknown graph request type");
    }
  }

  private escape(reason: string, nextStep?: string): ITtscGraphEscape {
    return {
      type: "escape",
      skipped: true,
      reason,
      ...(nextStep !== undefined ? { nextStep } : {}),
    };
  }
}
