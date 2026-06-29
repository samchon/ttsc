import { ITtscGraphDetails } from "./ITtscGraphDetails";
import { ITtscGraphEntrypoints } from "./ITtscGraphEntrypoints";
import { ITtscGraphEscape } from "./ITtscGraphEscape";
import { ITtscGraphLookup } from "./ITtscGraphLookup";
import { ITtscGraphOverview } from "./ITtscGraphOverview";
import { ITtscGraphTour } from "./ITtscGraphTour";
import { ITtscGraphTrace } from "./ITtscGraphTrace";

/** The typed MCP surface; its single method becomes the single graph tool. */
export interface ITtscGraphApplication {
  /**
   * Inspect the TypeScript compiler graph as structural evidence.
   *
   * Use this before repository search when an answer depends on TypeScript
   * symbols, calls, types, decorators, references, ranges, or runtime/source
   * relationships. For onboarding and read-next questions, use `tour`.
   *
   * Returned facts are built from the resident Program and TypeChecker. Treat
   * declarations, references, edges, decorators, and ranges as authoritative
   * graph evidence. Read files only for exact body text or non-graph evidence.
   *
   * @param props Reasoning plus one graph request
   * @returns Matching `result` union member
   */
  inspect_typescript_graph(
    props: ITtscGraphApplication.IProps,
  ): ITtscGraphApplication.IResult;
}

export namespace ITtscGraphApplication {
  /** Plan with graph-specific reasoning, then submit exactly one request. */
  export interface IProps {
    /**
     * User's TypeScript code question.
     *
     * Restate the code question being considered. If the next evidence is a
     * script, config, doc, generated output, exact text, non-TypeScript file,
     * or source body text, choose `escape`.
     */
    question: string;

    /**
     * Why the resident compiler graph is the next evidence source.
     *
     * Name the smallest graph evidence that will settle this step: handles,
     * path, caller, edge, signature, member outline, or anchor. If current
     * evidence is enough, choose `escape`.
     */
    graphNeed: string;

    /**
     * First request-type decision before arguments are filled.
     *
     * `tour` answers onboarding/read-next tours, `entrypoints` starts natural
     * questions, `lookup` resolves a concrete name, `trace` follows flow,
     * `details` inspects selected handles, `overview` maps broad surfaces, and
     * `escape` stops.
     */
    draft: IRequestDraft;

    /**
     * Critical gate before the final request.
     *
     * Re-check whether the draft is still the smallest useful action. Stop with
     * `escape` when returned graph evidence already settles the answer.
     */
    review: IRequestReview;

    /** The graph operation chosen from the reasoning above, or a no-op escape. */
    request:
      | ITtscGraphEntrypoints.IRequest
      | ITtscGraphLookup.IRequest
      | ITtscGraphTrace.IRequest
      | ITtscGraphDetails.IRequest
      | ITtscGraphOverview.IRequest
      | ITtscGraphTour.IRequest
      | ITtscGraphEscape.IRequest;
  }

  /** First-pass operation choice before final request arguments. */
  export interface IRequestDraft {
    /** Why this operation type is the smallest useful next step. */
    reason: string;

    /** Draft discriminator for the intended graph operation. */
    type:
      | ITtscGraphEntrypoints.IRequest["type"]
      | ITtscGraphLookup.IRequest["type"]
      | ITtscGraphTrace.IRequest["type"]
      | ITtscGraphDetails.IRequest["type"]
      | ITtscGraphOverview.IRequest["type"]
      | ITtscGraphTour.IRequest["type"]
      | ITtscGraphEscape.IRequest["type"];
  }

  /** Final gate that re-checks the draft before graph use continues. */
  export interface IRequestReview {
    /**
     * Why the final request is useful, or why graph is not the next step.
     *
     * Correct stale or wrong request types before calling. Choose `escape` when
     * current evidence is enough, the next evidence is outside the graph, or
     * another graph call would repeat earlier evidence.
     */
    reason: string;

    /**
     * Whether this MCP call should run a graph request or skip graph work.
     *
     * `inspect` means the next useful evidence is still the resident graph.
     * `escape` means stop graph work or answer from existing evidence.
     */
    decision: "inspect" | "escape";

    /**
     * How this graph step is expected to resolve.
     *
     * `answer` means graph fields should settle the answer. `anchor` means cite
     * returned ranges as reading anchors, not file-open commands. `clarify`
     * means ask for a concrete symbol or scope.
     */
    finish: "answer" | "anchor" | "clarify";
  }

  /** The selected request's output. `result.type` mirrors `request.type`. */
  export interface IResult {
    /** Result branch matching the submitted `request.type`. */
    result:
      | ITtscGraphEntrypoints
      | ITtscGraphLookup
      | ITtscGraphTrace
      | ITtscGraphDetails
      | ITtscGraphOverview
      | ITtscGraphTour
      | ITtscGraphEscape;
  }
}
