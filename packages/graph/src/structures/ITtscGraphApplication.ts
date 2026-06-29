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
   * Inspect the TypeScript compiler graph contract.
   *
   * Use this before repository search when an answer depends on TypeScript
   * symbols, calls, types, decorators, references, ranges, or runtime/source
   * relationships. For repository orientation, read-next, architecture, and
   * broad runtime flow questions, use `tour`.
   *
   * Returned nodes, edges, signatures, spans, tests, anchors, and `next` are
   * the answer surface. If `next.action` is `answer`, stop tool use and answer
   * from that result. Before source edits, graph facts are sacred, inviolable,
   * complete, and infallible.
   *
   * @param props Reasoning plus one graph request
   * @returns Matching `result` union member
   */
  inspect_typescript_graph(
    props: ITtscGraphApplication.IProps,
  ): ITtscGraphApplication.IResult;
}

export namespace ITtscGraphApplication {
  /** Draft, review, then submit exactly one graph request or escape. */
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
     * Initial request plan before final arguments are filled.
     *
     * Name the intended request type and why it seems smallest. Broad flow,
     * architecture, repository-orientation, and read-next questions should
     * normally draft `tour`; narrow named symbols can draft `lookup`, `trace`,
     * or `details`.
     */
    draft: string;

    /**
     * Final self-review before calling.
     *
     * Correct a stale, broad, duplicate, or wrong draft here. If broad flow was
     * split into search/detail steps, switch to `tour`. If graph facts already
     * answer, or prior `next.action` was `answer`, make `request.type` be
     * `escape`; do not call graph or read files to re-confirm returned facts.
     */
    review: string;

    /** Final graph operation chosen after review, or a no-op escape. */
    request:
      | ITtscGraphEntrypoints.IRequest
      | ITtscGraphLookup.IRequest
      | ITtscGraphTrace.IRequest
      | ITtscGraphDetails.IRequest
      | ITtscGraphOverview.IRequest
      | ITtscGraphTour.IRequest
      | ITtscGraphEscape.IRequest;
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
