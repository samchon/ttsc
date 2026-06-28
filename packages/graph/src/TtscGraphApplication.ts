import { TtscGraphMemory } from "./model/TtscGraphMemory";
import { runDetails } from "./server/runDetails";
import { runEntrypoints } from "./server/runEntrypoints";
import { runLookup } from "./server/runLookup";
import { runOverview } from "./server/runOverview";
import { runTrace } from "./server/runTrace";
import { ITtscGraphApplication } from "./structures/ITtscGraphApplication";
import { ITtscGraphEscape } from "./structures/ITtscGraphEscape";

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

  public query(
    props: ITtscGraphApplication.IProps,
  ): ITtscGraphApplication.IResult {
    switch (props.request.type) {
      case "entrypoints":
        return { result: runEntrypoints(this.graph(), props.request) };
      case "lookup":
        return { result: runLookup(this.graph(), props.request) };
      case "trace":
        return { result: runTrace(this.graph(), props.request) };
      case "details":
        return { result: runDetails(this.graph(), props.request) };
      case "overview":
        return { result: runOverview(this.graph(), props.request) };
      case "escape": {
        const result: ITtscGraphEscape = {
          type: "escape",
          skipped: true,
          reason: props.request.reason,
        };
        if (props.request.nextStep !== undefined) {
          result.nextStep = props.request.nextStep;
        }
        return {
          result,
        };
      }
      default:
        throw new Error("Unknown graph request type");
    }
  }
}
