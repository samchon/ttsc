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
 * `inspect_typescript_graph` returns a compiler-built TypeScript graph contract
 * for the current on-disk source snapshot.
 *
 * Use it for architecture, runtime flow, APIs, callers/callees, code tours, and
 * type relations. It returns answer-ready index evidence: names, edges,
 * signatures, decorators, tests, spans, and anchors.
 *
 * The facts come from the compiler's checker over the snapshot each call syncs
 * to, so they are resolved rather than searched or inferred. It is an index,
 * not the source text: it carries no function bodies, and a returned span is a
 * finished citation.
 *
 * ## Requests
 *
 * A request is a union: pick the single type below that best fits the question,
 * and submit exactly that one.
 *
 * - `tour`: architecture, runtime flow, orientation, or a code tour. One call is
 *   the whole answer; do not split it.
 * - `entrypoints`: find where execution starts when entry points are unknown.
 * - `lookup`: locate a named symbol.
 * - `trace`: follow calls or data flow forward or backward from a symbol.
 * - `details`: signatures, members, and relations of named symbols.
 * - `overview`: project layers and folder structure.
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
 * ## What a Result Already Settles
 *
 * A returned node, span, edge, signature, decorator, test, or step is checker
 * output for the snapshot it synced to. Re-deriving one by hand — opening the
 * cited file to confirm it, searching for a name it already resolved,
 * re-tracing an edge it already returned — costs tokens and yields the same
 * fact.
 *
 * The graph carries no source bodies. Read a file when you need body text, an
 * exact string, or a non-TypeScript file, and after you edit the source, call
 * again so the graph re-syncs.
 *
 * ## Stop
 *
 * The graph is built to answer in one call; the result says when it has.
 *
 * - `next` reports where the result leaves the question: `answer` means it covers
 *   it, `inspect` names the one further request that completes it, `outside`
 *   means the evidence is not in the graph.
 * - A tour is the whole orientation answer: cite its entrypoints, flow, nearby
 *   paths, tests, and anchors instead of re-walking them call by call.
 */
export interface ITtscGraphApplication {
  /**
   * Inspect the TypeScript compiler graph before searching the repo, for any
   * answer about symbols, calls, types, references, or flow.
   *
   * Use `tour` for architecture and broad flow: one call carries the whole
   * orientation answer.
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
