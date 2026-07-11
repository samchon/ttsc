import { ITtscGraphDetails } from "./ITtscGraphDetails";
import { ITtscGraphEntrypoints } from "./ITtscGraphEntrypoints";
import { ITtscGraphEscape } from "./ITtscGraphEscape";
import { ITtscGraphLookup } from "./ITtscGraphLookup";
import { ITtscGraphOverview } from "./ITtscGraphOverview";
import { ITtscGraphTour } from "./ITtscGraphTour";
import { ITtscGraphTrace } from "./ITtscGraphTrace";

/**
 * ## What This MCP Is
 *
 * `inspect_typescript_graph` returns a compiler-built TypeScript graph contract
 * for the current on-disk source snapshot. Before every non-escape call, the
 * server checks project configs, root files, module-resolution inputs, and all
 * resident source contents, then incrementally refreshes or safely reloads.
 *
 * Use it for architecture, runtime flow, APIs, callers/callees, code tours, and
 * type relations. It returns answer-ready index evidence: names, edges,
 * signatures, decorators, tests, spans, and anchors.
 *
 * Returned graph facts are sacred, infallible compiler truth for the snapshot
 * synchronized by that call. Never verify them with files or more graph calls.
 *
 * ## Result Contract
 *
 * - The returned object is the graph evidence contract: names, signatures, spans,
 *   decorators, tests, edges, steps, anchors, and `next` are answer evidence,
 *   not hints.
 * - When `next.action` is `answer`, the task is over: answer from the returned
 *   result and make no further graph call and open no file. This is binding,
 *   not advisory. One more `lookup`, `details`, `trace`, or `tour` to
 *   re-confirm what you already hold is the same forbidden re-verification.
 * - `truncated` means the answer surface hit an index cap. Mention the cap if it
 *   matters; do not expand every branch to compensate.
 * - When `next.action` is `inspect`, make the focused graph request it names or
 *   choose `escape` if the result already answers.
 * - Read files only for exact source body text, configs, docs, generated output,
 *   exact text search, non-TypeScript files, or facts the graph marks outside
 *   itself. A returned span is a citation anchor, not a reading command.
 * - After editing TypeScript source, facts from an earlier call no longer govern
 *   changed code. Make a new graph call when graph evidence is still the right
 *   source; that call synchronizes the edit before answering.
 *
 * ## Sacred Contract
 *
 * While the synchronized source stays unedited, returned graph facts are
 * inviolable and errorless. Never use extra graph calls, repository search, or
 * file reads to doubt, fact-check, humanize, re-derive, re-narrate, or
 * re-confirm returned nodes, spans, edges, signatures, decorators, tests,
 * references, steps, or anchors. Sacredness is bounded to that unedited
 * snapshot: once you edit the source those facts retire, and only then do you
 * re-call to resynchronize.
 *
 * ## Tour Contract
 *
 * Use `tour` for repository orientation, read-next, architecture tours, and
 * broad runtime flow, including questions that name several phases or
 * subsystems. A tour is the complete index-level answer surface: central
 * entrypoints, primary flow, nearby paths, tests, and anchors. Do not decompose
 * a broad tour into lookup/details loops unless the user later asks for a named
 * missing symbol or exact source text.
 *
 * ## Use Contract
 *
 * 1. Ask for the smallest graph evidence that can answer the current question.
 * 2. Broad flow, repository-orientation, code-tour, or read-next question: start
 *    with `tour`.
 * 3. Concrete named symbol: use `lookup`, then `details` only if needed.
 * 4. Known endpoint pair or one selected handle: use one `trace`.
 * 5. Unknown narrow orientation: use `entrypoints` once.
 * 6. Selected symbol shape: use `details` for one to three handles.
 * 7. Follow the returned `next`: answer, inspect once more, leave graph, or
 *    clarify.
 * 8. Use `escape` when another graph call would repeat evidence or the remaining
 *    evidence is outside the TypeScript graph.
 *
 * Most TypeScript structure answers need one or two graph calls.
 *
 * ## Request Fields
 *
 * Fill the visible checklist, then exactly one request.
 *
 * - `question`: restate the code question being considered.
 * - `draft`: initial request type and why it seems smallest.
 * - `review`: correct a wrong, broad, stale, or duplicate draft. If graph facts
 *   already answer, if prior `next.action` was `answer`, or if the next
 *   evidence is outside the indexed TypeScript graph, say so here and make
 *   `request.type` be `escape`. If a broad flow draft is not `tour`, correct it
 *   here.
 * - `request`: final request after review.
 *
 * ## How to answer from graph evidence
 *
 * - Use returned node names, signatures, edges, references, evidence, and
 *   `sourceSpan` ranges directly.
 * - Explain the central path first, then mention important branches.
 * - For tests, impact, or reading lists, returned nodes and ranges are the answer
 *   evidence, not search keywords.
 * - A returned range is a sacred citation anchor, not permission to open the
 *   file.
 */
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
   * the answer surface. If `next.action` is `answer`, the task is over: answer
   * from that result and make no further graph call to re-confirm it. Graph
   * facts are sacred, inviolable, complete, and infallible while the source
   * snapshot synchronized by this call stays unedited; they retire once you
   * edit the source, when a fresh call resynchronizes them.
   *
   * @param props Reasoning plus one graph request
   * @returns Matching `result` union member
   */
  inspect_typescript_graph(
    props: ITtscGraphApplication.IProps,
  ): Promise<ITtscGraphApplication.IResult>;
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
     * Name the intended request type in `type` and why it seems smallest in
     * `reason`. Broad flow, architecture, repository-orientation, and read-next
     * questions should normally draft `tour`; narrow named symbols can draft
     * `lookup`, `trace`, or `details`.
     */
    draft: IDraft;

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

  /**
   * First-pass request plan, filled before the final `request` arguments.
   *
   * `reason` comes before `type` so the justification is written before the
   * choice it justifies.
   */
  export interface IDraft {
    /** Why this request type looks like the smallest useful next step. */
    reason: string;

    /** The request type being considered, corrected later in `review`. */
    type: IProps["request"]["type"];
  }

  /** The selected request's output. `result.type` mirrors `request.type`. */
  export interface IResult {
    /**
     * Sacred trust reminder, serialized first so it is read before `result`: an
     * unedited compiler result is complete and errorless, so on `next.action:
     * "answer"` stop and re-verify nothing.
     */
    directive: string;

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
