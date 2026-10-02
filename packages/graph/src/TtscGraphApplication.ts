import { TtscGraphMemory } from "./model/TtscGraphMemory";
import {
  RESULT_AUDIT,
  RESULT_AUDIT_DETAILS,
  RESULT_AUDIT_DETAILS_CAPPED,
  RESULT_AUDIT_ESCAPE,
  RESULT_AUDIT_SELECTION,
} from "./server/resultAudit";
import { resultNext } from "./server/resultNext";
import { runDetails } from "./server/runDetails";
import { runEntrypoints } from "./server/runEntrypoints";
import { runLookup } from "./server/runLookup";
import { runOverview } from "./server/runOverview";
import { runTour } from "./server/runTour";
import { runTrace } from "./server/runTrace";
import { ITtscGraphApplication } from "./structures/ITtscGraphApplication";
import { ITtscGraphEscape } from "./structures/ITtscGraphEscape";

/**
 * A fixed graph generation or a provider synchronizing one before each request.
 *
 * @evidence contracts/common.md#principled-implementation The union admits resident values and synchronous/asynchronous producers with the same graph result contract.
 * @evidence contracts/common.md#clear-and-simple-design One provider boundary lets dispatch use fixed dumps and refreshing sessions without separate applications.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Refresh remains a supplied ownership boundary instead of foreign graph mutation.
 * @evidence contracts/common.md#meaningful-documentation The native headline states fixed versus synchronized generation and the provider's timing.
 */
export type TtscGraphSource =
  | TtscGraphMemory
  | (() => TtscGraphMemory | Promise<TtscGraphMemory>);

/**
 * The MCP tool surface as a plain class over the resident
 * {@link TtscGraphMemory}.
 *
 * Its public method is the MCP tool: `typia.llm.controller` reflects
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
 *
 * @evidence contracts/common.md#principled-implementation Exhaustive request dispatch chooses the matching graph operation and its operation-specific audit; escape bypasses graph acquisition entirely.
 * @evidence contracts/common.md#clear-and-simple-design The class binds one graph provider to pure runners, leaving traversal and ranking with their owning functions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No forced first lookup or agent-specific call suppression is introduced; legitimate escape and incomplete coverage remain explicit.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain reflected tool wiring, provider refresh and source-free result ownership.
 */
export class TtscGraphApplication implements ITtscGraphApplication {
  private readonly graph: () => TtscGraphMemory | Promise<TtscGraphMemory>;

  public constructor(source: TtscGraphSource) {
    this.graph = typeof source === "function" ? source : () => source;
  }

  /**
   * Synchronize the graph once and dispatch the selected request.
   *
   * Escape returns an explicit no-op before invoking the provider. Ranked
   * operations report heuristic selection; details distinguishes capped members
   * from its complete identity facts.
   *
   * @evidence contracts/common.md#principled-implementation Each discriminated branch returns its corresponding runner result with the audit appropriate to that operation's actual completeness.
   * @evidence contracts/common.md#clear-and-simple-design The exhaustive switch owns only dispatch and audit choice; runners own graph semantics and the provider owns synchronization.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Escape does no indexing, and heuristic selection is not advertised as exhaustive compiler proof.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains provider timing, no-op escape and operation-specific completeness before the tags.
   */
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
        // A ranked shortlist matched against the question: its facts are
        // compiler-verified, but its selection is heuristic, so it carries the
        // selection audit rather than the exact-structure one.
        const r = runEntrypoints(graph, props.request);
        return {
          audit: RESULT_AUDIT_SELECTION,
          next: r.next,
          result: r.result,
        };
      }
      case "lookup": {
        // Natural-query ranker (see `runLookup`): scored, ranked, per-file
        // capped, and limited, so the selection is heuristic.
        const r = runLookup(graph, props.request);
        return {
          audit: RESULT_AUDIT_SELECTION,
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
        // details' identity is complete and its fan-out is a slice, which is
        // not the walk-bounded-and-marked shape RESULT_AUDIT states.
        const r = runDetails(graph, props.request);
        return {
          audit:
            r.membersCapped === true
              ? RESULT_AUDIT_DETAILS_CAPPED
              : RESULT_AUDIT_DETAILS,
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
        // — the caller wrote it once, at the top, in the user's words. It
        // ranks seeds, walks bounded flows, and slices to a limit, so its
        // selection is heuristic.
        const r = runTour(graph, props.request, props.question);
        return {
          audit: RESULT_AUDIT_SELECTION,
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
