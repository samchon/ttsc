import { ITtscGraphDetails } from "./ITtscGraphDetails";
import { ITtscGraphEntrypoints } from "./ITtscGraphEntrypoints";
import { ITtscGraphEscape } from "./ITtscGraphEscape";
import { ITtscGraphLookup } from "./ITtscGraphLookup";
import { ITtscGraphOverview } from "./ITtscGraphOverview";
import { ITtscGraphTrace } from "./ITtscGraphTrace";

/**
 * The MCP tool surface of `@ttsc/graph`, as a typed application.
 *
 * The single method is the single MCP tool. Its parameter object becomes the
 * JSON schema once `typia.llm.controller` reflects this interface.
 * `TtscGraphApplication` implements it over the resident graph.
 */
export interface ITtscGraphApplication {
  /**
   * Query the TypeScript project graph for code evidence.
   *
   * Use this before answering TypeScript codebase questions. It returns
   * checker-resolved symbols, dependency paths, sourceSpan anchors, and narrow
   * bodies from the resident graph, avoiding assumptions, shell search, or file
   * reads when graph evidence is enough.
   *
   * Fill properties in order: question, graphNeed, draft, review, request.
   * Write `draft.reason` before `draft.type`, then choose `entrypoints`,
   * `lookup`, `trace`, `details`, `overview`, or `escape`.
   *
   * Keep slices small. Prefer defaults. Raise limits only after truncation or
   * ambiguity. Keep dependency maps and source reads separate; use
   * `source:true` only for decisive leaf bodies.
   *
   * @param props The reasoning and selected graph request
   * @returns One `result` union member matching the selected request type
   */
  query(props: ITtscGraphApplication.IProps): ITtscGraphApplication.IResult;
}

export namespace ITtscGraphApplication {
  /** Think, review, then submit exactly one graph request. */
  export interface IProps {
    /**
     * User's TypeScript code question.
     *
     * Restate the codebase question being answered. Keep this about TypeScript
     * source, symbols, call flow, type flow, or architecture. If the user is
     * asking about scripts, config, generated output, or documentation instead,
     * say that boundary here.
     */
    question: string;

    /**
     * Why the resident graph is the next evidence source.
     *
     * State what graph evidence is needed and why assumptions, shell search, or
     * source file reads are not the next step for this call. Name the smallest
     * evidence that would let the agent stop. If graph is not actually the
     * right source, say that and use `escape`.
     */
    graphNeed: string;

    /**
     * First request-type decision before arguments are filled.
     *
     * Explain why one operation class is smaller than the alternatives, then
     * name it in `draft.type`. This is only the draft; the final arguments are
     * in `request` after `review`.
     */
    draft: IRequestDraft;

    /**
     * Critical review of the draft request.
     *
     * Check whether the draft avoids overfetch, non-graph fallback, broad
     * source reads, and unnecessary neighbor/source combinations. For caller or
     * call-site questions, prefer reverse trace or details with
     * `neighbors:true`. For exact in-body line anchors, request graph source
     * line numbers. If the draft is wrong, choose the corrected type in
     * `request`; if graph evidence is unnecessary or the prior graph result
     * already answers the question, choose `escape`.
     */
    review: string;

    /** The graph operation chosen from the reasoning above, or a no-op escape. */
    request:
      | ITtscGraphEntrypoints.IRequest
      | ITtscGraphLookup.IRequest
      | ITtscGraphTrace.IRequest
      | ITtscGraphDetails.IRequest
      | ITtscGraphOverview.IRequest
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
      | ITtscGraphEscape.IRequest["type"];
  }

  /** The selected request's output. `result.type` mirrors `request.type`. */
  export interface IResult {
    result:
      | ITtscGraphEntrypoints
      | ITtscGraphLookup
      | ITtscGraphTrace
      | ITtscGraphDetails
      | ITtscGraphOverview
      | ITtscGraphEscape;
  }
}
