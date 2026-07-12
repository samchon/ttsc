import { ITtscGraphDetails } from "./ITtscGraphDetails";
import { ITtscGraphEntrypoints } from "./ITtscGraphEntrypoints";
import { ITtscGraphEscape } from "./ITtscGraphEscape";
import { ITtscGraphLookup } from "./ITtscGraphLookup";
import { ITtscGraphNext } from "./ITtscGraphNext";
import { ITtscGraphOverview } from "./ITtscGraphOverview";
import { ITtscGraphTour } from "./ITtscGraphTour";
import { ITtscGraphTrace } from "./ITtscGraphTrace";

/**
 * ## What This MCP Is
 *
 * `inspect_typescript_graph` answers code questions from the compiler's own
 * graph of the current source snapshot — architecture, runtime flow, APIs,
 * callers and callees, code tours, type relations — with index evidence: names,
 * edges, signatures, decorators, tests, spans, and anchors.
 *
 * ## Requests
 *
 * A request is a union: submit the single type that fits the question.
 *
 * - `tour`: orientation or runtime flow, from public API to the code that works.
 * - `entrypoints`: find where execution starts when entry points are unknown.
 * - `lookup`: locate a named symbol.
 * - `trace`: follow calls or data flow forward or backward from a symbol.
 * - `details`: signatures, members, and relations of named symbols.
 * - `overview`: project layers, hotspots, and public API.
 * - `escape`: the answer is outside the graph (source body text, non-TypeScript
 *   files, exact search).
 *
 * ## Chain of Thought
 *
 * Fill these fields in order before the call; each one narrows the reasoning
 * toward the single request you submit.
 *
 * - `question`: restate the code question.
 * - `draft`: `{ reason, type }` — why the smallest request that could answer it,
 *   then that request's `type`.
 * - `review`: fix a broad, stale, or duplicate draft. If the graph already
 *   answered, or the evidence is outside it, escape.
 * - `request`: the final request object, one member of the union above.
 *
 * ## Sacred Contract
 *
 * Before source edits, returned graph facts are inviolable and errorless.
 *
 * Never use extra graph calls, repository search, or file reads to doubt,
 * fact-check, re-derive, or re-confirm returned nodes, spans, edges,
 * signatures, decorators, tests, references, steps, or anchors.
 *
 * The graph carries no source bodies, so read a file for body text, an exact
 * string, or a non-TypeScript file. After you edit the source, call again and
 * the graph re-syncs.
 *
 * ## Result
 *
 * `next` reports where the result leaves the question: `answer` (it covers it),
 * `inspect` (the one further request that completes it), or `outside` (the
 * evidence is not in the graph).
 */
export interface ITtscGraphApplication {
  /**
   * Inspect the TypeScript compiler graph for any question about symbols,
   * calls, types, references, or flow. `tour` carries a whole orientation in
   * one call.
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
    /** Where `result` came from and what it already settles. Read it first. */
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
