import { ITtscGraphDetails } from "./ITtscGraphDetails";
import { ITtscGraphEntrypoints } from "./ITtscGraphEntrypoints";
import { ITtscGraphEscape } from "./ITtscGraphEscape";
import { ITtscGraphLookup } from "./ITtscGraphLookup";
import { ITtscGraphNext } from "./ITtscGraphNext";
import { ITtscGraphOverview } from "./ITtscGraphOverview";
import { ITtscGraphTour } from "./ITtscGraphTour";
import { ITtscGraphTrace } from "./ITtscGraphTrace";

/**
 * ## Code Graph MCP
 *
 * `inspect_typescript_graph` returns a compiler-built TypeScript graph contract
 * for the current on-disk source snapshot.
 *
 * Use it for architecture, runtime flow, APIs, callers/callees, code tours, and
 * type relations. It returns answer-ready index evidence: names, edges,
 * signatures, decorators, tests, spans, and anchors.
 *
 * Every returned fact — each name, edge, signature, and span — is
 * compiler-resolved and verified for the snapshot that call synchronized, so
 * trust it without re-checking against files. Where an operation ranks a
 * shortlist against your question (`lookup`, `entrypoints`, `tour`), the facts
 * stay verified but the selection is heuristic: judge whether its coverage
 * answers you, and a follow-up request or a read of a cited span is fair when
 * it does not.
 *
 * ## Requests
 *
 * A request is a union: pick the single type below that best fits the question,
 * and submit exactly that one.
 *
 * - `tour`: architecture, runtime flow, orientation, or a code tour. One call is
 *   the whole answer; do not split it. Name the machinery you expect it to be
 *   made of in its `reinterpretations`, or send none.
 * - `entrypoints`: find where execution starts when entry points are unknown.
 * - `lookup`: locate a named symbol, or — with a documentation target as the
 *   query (`docs/pricing.md#sale`, `POST:/orders`) — the declarations whose
 *   documentation cites it.
 * - `trace`: follow calls or data flow forward or backward from a symbol, or —
 *   with `to` — the path between two symbols when both ends are known, which is
 *   the one call that answers "how does A reach B".
 * - `details`: signatures, members, and relations of named symbols — including
 *   the classes that implement an interface, which is the one call that answers
 *   "what actually implements this".
 * - `overview`: project layers and folder structure.
 * - `escape`: the answer is outside the graph (source body text, non-TypeScript
 *   files, exact search).
 *
 * ## Chain of Thought
 *
 * Fill these fields in order before the call; each one narrows the reasoning
 * toward the single request you submit.
 *
 * - `question`: the code question, in the user's own words.
 * - `draft`: `{ reason, type }` — why the smallest request that could answer it,
 *   then that request's `type`.
 * - `review`: fix a broad, stale, or duplicate draft. If the graph already
 *   answered, or the evidence is outside it, escape.
 * - `request`: the final choice. Each branch documents its own fields; fill them
 *   from what the branch says, not from what another branch wanted.
 *
 * ## What to trust
 *
 * Before source edits, every returned fact is compiler-resolved and verified.
 * Never use extra graph calls, repository search, or file reads to doubt,
 * fact-check, re-derive, re-narrate, or re-confirm a returned node, span, edge,
 * signature, decorator, test, reference, step, or anchor. The server resolved
 * each one to the type-checked program for the snapshot the call synced to, and
 * `audit` says so on every result.
 *
 * Selection is the separate question. `lookup`, `entrypoints`, and `tour` match
 * your question and return a scored, ranked, per-file-capped, limited
 * shortlist; their facts are still verified, but whether the shortlist covers
 * what you asked is yours to judge, and their `audit` says that instead of
 * claiming completeness. A follow-up request or a read of a cited span for
 * missed coverage is legitimate — re-confirming a fact the graph already
 * resolved is not.
 *
 * ## Stop
 *
 * Let the result's `next` set the pace, and do not re-confirm what the graph
 * resolved.
 *
 * - A span is a citation, not a cue to open the file to re-check a fact.
 * - Follow the result's `next`: `answer` means stop and answer from it, `inspect`
 *   means make exactly the one request it names, `outside` means escape,
 *   `clarify` means restate the request.
 * - For a ranked shortlist (`lookup`, `entrypoints`, `tour`), `next` and
 *   `truncated` say whether coverage is settled; when it is not, one more
 *   request is the right move — not a file read to re-verify facts already
 *   given.
 *
 * @evidence contracts/common.md#principled-implementation The single async tool maps the discriminated request union to graph outputs, with audit and next separated from returned facts.
 * @evidence contracts/common.md#clear-and-simple-design One tool owns graph dispatch; request branches keep their own shapes instead of independent nearly identical tools.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The instruction retains explicit escape and permits legitimate coverage follow-ups without forced graph calls.
 * @evidence contracts/common.md#meaningful-documentation Markdown-structured native documentation explains request choice, trust boundaries and ranked coverage before the tags.
 */
export interface ITtscGraphApplication {
  /**
   * Answer a TypeScript question from the compiler's own index of this
   * repository.
   *
   * The graph holds every symbol, call, type, decorator and test, each with its
   * file and line, resolved from the source on disk now. Submit exactly one
   * request:
   *
   * - `tour`: architecture, the runtime flow from the public API to the code that
   *   does the work, nearby paths, and the tests to read — a whole orientation
   *   in one call
   * - `trace`: what a symbol calls, what calls it, or the path from A to B
   * - `details`: signatures, members, and what implements an interface
   * - `lookup`: where a named symbol is declared
   * - `entrypoints`: where execution starts, when the entry is unknown
   * - `overview`: the project's layers and folder structure
   *
   * Every fact in a result is the checker's own resolution, audited before
   * return, so no fact needs verifying; for the ranked operations (`lookup`,
   * `entrypoints`, `tour`), judge whether the shortlist covers your question.
   * Read a file for what the graph does not carry: a body, the text in a span.
   *
   * @param props Reasoning plus one graph request
   * @returns Matching `result` union member
   * @evidence contracts/common.md#principled-implementation The callable consumes the typed reasoning/request envelope and returns the typed audit, next action and result envelope asynchronously.
   * @evidence contracts/common.md#clear-and-simple-design One method delegates branch semantics to the request union instead of duplicating parameter lists.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The supported method includes escape and does not require graph use for source bodies.
   * @evidence contracts/common.md#meaningful-documentation Native prose lists request responsibilities, distinguishes ranking coverage and explains the body-text boundary with param/return tags.
   */
  inspect_typescript_graph(
    props: ITtscGraphApplication.IProps,
  ): Promise<ITtscGraphApplication.IOutput>;
}

export namespace ITtscGraphApplication {
  /**
   * Draft, review, then submit exactly one graph request or escape.
   *
   * @evidence contracts/common.md#principled-implementation Required question, draft, review and discriminated final request represent the public selection protocol without treating rationale as graph evidence.
   * @evidence contracts/common.md#clear-and-simple-design The final request union owns branch-specific fields; shared selection context is stored once.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Escape remains in the union and question wording is not replaced by a hidden repository-specific prompt.
   * @evidence contracts/common.md#meaningful-documentation Native member comments explain question preservation, draft correction and one final branch.
   */
  export interface IProps {
    /**
     * The code question, in the user's own words.
     *
     * Cut a long message down to the sentences that state the ask, but keep
     * their terms: the graph ranks against these words, so a rewrite ranks a
     * different answer.
     */
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

  /**
   * First-pass plan; `reason` precedes `type` so it is written first.
   *
   * @evidence contracts/common.md#principled-implementation Reason explains selection while the request-indexed type union restricts the proposed operation to a supported branch.
   * @evidence contracts/common.md#clear-and-simple-design Two fields represent the draft without copying branch inputs before review.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The proposed operation remains caller-authored rather than a forced first call.
   * @evidence contracts/common.md#meaningful-documentation Native comments explain the selection reason and proposed request type in separate member blocks.
   */
  export interface IDraft {
    /** Why this is the smallest useful next step. */
    reason: string;

    /** The request type being considered. */
    type: IProps["request"]["type"];
  }

  /**
   * The selected request's output. `result.type` mirrors `request.type`.
   *
   * @evidence contracts/common.md#principled-implementation Audit, next decision and discriminated result preserve different roles: provenance report, supported follow-up and graph facts.
   * @evidence contracts/common.md#clear-and-simple-design Shared audit/control fields wrap the existing result branches without duplicating their contents.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Ranked selection is explicitly heuristic and cannot be certified complete merely by valid node facts.
   * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain operation-aware audit and ranked coverage; member comments define next and matching result branch.
   */
  export interface IOutput {
    /**
     * What the server audited this result against before returning it, in its
     * own words: every node, span, edge, signature, member, and step in it
     * resolves to the type-checked program for the snapshot the call synced to,
     * so opening a file it cites only returns a fact already in it.
     *
     * The audit is operation-aware. For the walks from a named handle (`trace`,
     * `overview`) it reports the result as the structure the graph holds,
     * bounded where `truncated` says. For `details` it reports the two halves
     * of a resolved symbol: its own shape returned whole, its fan-out returned
     * as a slice with `trace` for the rest. For the ranked operations
     * (`lookup`, `entrypoints`, `tour`) it adds that the selection is heuristic
     * — matched, scored, ranked, and limited against the question — so the
     * facts are verified but the shortlist's coverage is the caller's to
     * judge.
     */
    audit: string;

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
