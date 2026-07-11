import { ITtscGraphDetails } from "./ITtscGraphDetails";
import { ITtscGraphEntrypoints } from "./ITtscGraphEntrypoints";
import { ITtscGraphEscape } from "./ITtscGraphEscape";
import { ITtscGraphLookup } from "./ITtscGraphLookup";
import { ITtscGraphNext } from "./ITtscGraphNext";
import { ITtscGraphOverview } from "./ITtscGraphOverview";
import { ITtscGraphTour } from "./ITtscGraphTour";
import { ITtscGraphTrace } from "./ITtscGraphTrace";

/**
 * ## Graph
 *
 * - `inspect_typescript_graph`: a type-checker-resolved graph of your TypeScript
 *   project, not text guesses.
 * - Returns declarations, signatures, edges (calls, extends, references),
 *   decorators, tests, and source spans.
 * - Every fact it returns is complete compiler truth, so never re-verify a fact
 *   it already gave.
 * - Editing the source changes only the parts it touches: re-query those, trust
 *   the rest.
 *
 * ## Which request
 *
 * - Architecture, flow, orientation, or a code tour: one `tour`. It is the whole
 *   answer; do not split it.
 * - A named symbol: `lookup`, then `details` or `trace` only if the question
 *   needs more.
 * - Unknown entry points: `entrypoints` once.
 *
 * ## Before you call (fill in order)
 *
 * - `question`: restate the code question.
 * - `draft`: the smallest request that could answer it, and why.
 * - `review`: fix a broad, stale, or duplicate draft. If the graph already
 *   answered, or the evidence is outside it, escape.
 * - `request`: the final choice.
 *
 * ## Stop
 *
 * - A returned result is the whole answer: answer from it and stop. A span is a
 *   citation, not a cue to open the file.
 * - Follow the result's `next`: `answer` means stop and answer from it, `inspect`
 *   means make exactly the one request it names, `outside` means escape.
 * - `escape` when the graph answered, or the need is outside it (source body
 *   text, non-TypeScript files, exact search).
 */
export interface ITtscGraphApplication {
  /**
   * Inspect the TypeScript compiler graph before searching the repo, for any
   * answer about symbols, calls, types, references, or flow. Use `tour` for
   * architecture and broad flow. On a returned `directive`, answer and stop.
   *
   * @param props Reasoning plus one graph request
   * @returns Matching `result` union member
   */
  inspect_typescript_graph(
    props: ITtscGraphApplication.IProps,
  ): Promise<ITtscGraphApplication.IOutput>;
}

export namespace ITtscGraphApplication {
  /** Draft, review, then submit exactly one graph request or escape. */
  export interface IProps {
    /** The code question being considered. */
    question: string;

    /** The smallest request that could answer, and why. */
    draft: IDraft;

    /**
     * Correct the draft. Escape if the graph already answered, or the next
     * evidence is outside the graph.
     */
    review: string;

    /** Final graph request chosen after review, or a no-op escape. */
    request:
      | ITtscGraphEntrypoints.IRequest
      | ITtscGraphLookup.IRequest
      | ITtscGraphTrace.IRequest
      | ITtscGraphDetails.IRequest
      | ITtscGraphOverview.IRequest
      | ITtscGraphTour.IRequest
      | ITtscGraphEscape.IRequest;
  }

  /** First-pass plan; `reason` precedes `type` so it is written first. */
  export interface IDraft {
    /** Why this is the smallest useful next step. */
    reason: string;

    /** The request type being considered. */
    type: IProps["request"]["type"];
  }

  /** The selected request's output. `result.type` mirrors `request.type`. */
  export interface IOutput {
    /**
     * Read first: an unedited compiler result is complete and errorless, so on
     * a returned result, answer and re-verify nothing.
     */
    directive: string;

    /** What to do with `result`: answer, inspect one named request, or escape. */
    next: ITtscGraphNext;

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
