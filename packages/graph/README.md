# `@ttsc/graph`

![banner of @ttsc/graph](https://ttsc.dev/og-graph.png)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/graph) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Your coding agent answers from the compiler instead of reading files.

One MCP tool answers a code question from a graph the TypeScript checker resolved, and its replies carry names, signatures, relationships, and source spans, never file bodies. Neither the crawl nor the answer grows with the repository, so the cost stays flat where [`codegraph`](https://github.com/colbymchenry/codegraph) and [`serena`](https://github.com/oraios/serena) swing with repository size:

![Agent token cost, common question, per repository](https://ttsc.dev/benchmark/svg/graph-common-codex-gpt-5.6-sol.svg)

## Setup

```bash
npm install -D @ttsc/graph
```

```json
{
  "mcpServers": {
    "ttsc-graph": {
      "command": "npx",
      "args": ["-y", "@ttsc/graph"]
    }
  }
}
```

Start the client from the project root. The server builds one resident graph, refreshes changed compiler-owned shards atomically, and answers every MCP call from memory.

`@ttsc/graph` reads the graph from the program `ttsc` type-checked, so the project needs `ttsc` and `typescript` installed alongside it. `ttsc` runs on the native TypeScript 7 compiler from the `typescript` package; it does not run on the legacy TypeScript v6.x compiler. There is no separate index step and no static-parser fallback: the graph is a byproduct of the type-check the compiler already runs, or it is not built at all.

## Benchmark

Each repository is measured with one headless agent run per arm (`baseline` with no MCP, `@ttsc/graph`, `codegraph`, `codebase-memory`, `serena`) on two prompt families, across two agent CLIs (`codex` and Claude Code). The corpus pins eight real TypeScript repositories.

Every arm that mounts a tool — this one and each comparator alike — is told the same single line, that code graph tools are provided, and nothing more; the baseline, which has no tool to be told about, is told to answer from this checkout rather than from what the model already remembers of a famous repository. A model that never opens its tool list cannot be judged on its tools, and a benchmark that names one tool and not another is measuring the naming.

### Common

Every repository is asked the same onboarding question, a plain code tour. Across the corpus, `@ttsc/graph` holds a flat, low median token cost while the alternatives swing with repository size.

![Agent token cost, shared onboarding question, Claude Code Sonnet](https://ttsc.dev/benchmark/svg/graph-common-claude-code-claude-sonnet-5.svg)

### Dedicated

`codegraph`'s own per-repository questions, verbatim, one architecture question per project.

![Agent token cost, project-specific questions, Claude Code Sonnet](https://ttsc.dev/benchmark/svg/graph-dedicated-claude-code-claude-sonnet-5.svg)

### Time to an answer

An index answers nothing until it is built, and a developer waits for it before the agent can ask anything at all. This is the other half of the trade: a tool that cuts the token bill and then spends twelve minutes indexing has moved the cost, not removed it.

The faded head of each bar is the cold index build, the solid tail is the LLM answering, and every bar is labelled `index / LLM` in the order you wait for them. The baseline has no index to build.

![Cold time to a first answer, per repository](https://ttsc.dev/benchmark/svg/graph-time-to-answer.svg)

At three million lines the index question stops being academic. On VS Code, `@ttsc/graph` builds in 29 seconds because the graph is a byproduct of the type-check the compiler runs anyway, while `codegraph` spends twelve minutes and serena four and a half.

The interactive charts, every model, and the method are on the benchmark page: https://ttsc.dev/docs/benchmark/graph

## How it works

```ts
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
 * Declaration facts come from the compiler for the synchronized snapshot.
 * The server derives file containers, containment, property kinds, path-convention test roles and dispatch
 * hops; lint plugins supply artifact facts. The result's audit distinguishes
 * these producers. Trust compiler facts without re-checking against files.
 * Where an operation ranks a shortlist against your question (`lookup`,
 * `entrypoints`, `tour`), its compiler facts retain that provenance while
 * selection is heuristic: judge whether its coverage
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
 * Before source edits, compiler declaration facts retain the resolution of the
 * synchronized snapshot. The server derives `file` containers, `contains`
 * ownership, `property` kinds, `dispatches` hops and path-convention `test`
 * roles from those declarations. Lint plugins supply document, data-model and API-operation facts; `audit`
 * identifies these distinct producers. Never use extra graph calls,
 * repository search, or file reads to doubt,
 * fact-check, re-derive, re-narrate, or re-confirm a returned node, span, edge,
 * signature, decorator, test, reference, step, or anchor. The result projects
 * the snapshot's facts and identifies their provenance; this server does not
 * perform a second compiler verification pass.
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
 * - For a ranked shortlist (`lookup`, `entrypoints`, `tour`), `next` says what
 *   the server checked, and only `lookup` flags matches its limit cut with
 *   `truncated`; judge the coverage of `entrypoints` and `tour` yourself. When
 *   it is not settled, one more request is the right move — not a file read to
 *   re-verify facts already given.
 */
export interface ITtscGraphApplication {
  /**
   * Answer a TypeScript question from the synchronized source snapshot.
   * Submit one request:
   *
   * - `tour`: architecture, runtime flow and nearby tests in one orientation
   * - `trace`: calls, callers or the path from A to B
   * - `details`: signatures, members and interface implementations
   * - `lookup`: named declarations
   * - `entrypoints`: where execution starts
   * - `overview`: project layers and folders
   * - `escape`: source bodies, span text or evidence outside the graph
   *
   * `audit` identifies compiler declaration facts, server-derived structure
   * and plugin artifact facts; it does not claim a second compiler check.
   * Judge the coverage of ranked `lookup`, `entrypoints` and `tour` shortlists.
   * Follow `next`; read source for omitted body text or missed coverage.
   *
   * @param props Reasoning plus one graph request
   * @returns Matching `result` union member
   */
  inspect_typescript_graph(
    props: ITtscGraphApplication.IProps,
  ): Promise<ITtscGraphApplication.IOutput>;
}

export namespace ITtscGraphApplication {
  /**
   * Draft, review, then submit exactly one graph request or escape.
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
   */
  export interface IDraft {
    /** Why this is the smallest useful next step. */
    reason: string;

    /** The request type being considered. */
    type: IProps["request"]["type"];
  }

  /**
   * The selected request's output. `result.type` mirrors `request.type`.
   */
  export interface IOutput {
    /**
     * The provenance and coverage of the returned projection. Compiler facts
     * belong to the synchronized program; file containers, containment,
     * property kinds, path-convention test roles and dispatch hops are server-derived structure. Artifact
     * facts come from the publishing lint plugin. This text reports those
     * origins without claiming a second compiler verification pass.
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
```

> [`packages/graph/src/structures/ITtscGraphApplication.ts`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphApplication.ts)

### Chain of thought

`question`, `draft`, and `review` are required fields, so the model writes its reasoning into the call itself: state the question, draft the smallest request, then review the draft. A prompt line can be ignored; a required field cannot.

The review is allowed to overturn the draft, and that matters more than the planning. When an agent like Claude Code enters the tool with a question the graph cannot answer, `review` replaces the drafted request on the spot, and `escape` backs out entirely. A wrong entry costs one small call instead of a derailed session.

### Precision over restriction

Nothing is forbidden. The tool description says when the graph applies and when to stop. Grep and file reads stay available, and the agent still uses them when they are the right move.

What keeps the agent on the graph is precision. Declaration facts come from the TypeScript compiler for the synchronized snapshot. The server derives file containers, containment, property kinds, path-convention test roles and dispatch hops from those facts; lint plugins publish document, data-model and API-operation facts. The result's `audit` identifies these origins and distinguishes ranked selection from compiler resolution. No file body is included.

Declaration signatures come from the native compiler's declaration heads. When a producer omits a head, the response omits `signature` instead of guessing from a source line that may contain an implementation body. Consumers can use the returned source span when they need the missing text.

Resident graph models own detached, frozen node and edge facts. Public model accessors expose recursively readonly records and buckets; editable query results copy their nested facets. Caller-owned dump and transaction inputs remain editable without changing retained generations.

### Comparison

[`serena`](https://github.com/oraios/serena) and [`codegraph`](https://github.com/colbymchenry/codegraph) fight the agent instead:

- dozens of tools around one graph, so the agent often picks the wrong entry point
- 100 to 150 lines of injected instructions, spent mostly on forbidding grep and file reads
- source snippets inlined into answers, which reintroduces the reading cost a graph exists to remove
- loosely structured answers the agent does not trust, so it goes back to reading the files to verify them
- no way to back out, so a wrong entry keeps paying tool calls instead of escaping

Here the same policy fits in one typed contract, enforced by schema instead of pleaded for in prose.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

- Motivation: real-world use of [`codegraph`](https://github.com/colbymchenry/codegraph) that raised token cost instead of lowering it and visibly degraded agent reasoning.
- Launch post: [why I built it](https://ttsc.dev/blog/i-made-ts-compiler-graph-mcp), and how it compares to [`codegraph`](https://github.com/colbymchenry/codegraph), [`codebase-memory-mcp`](https://github.com/DeusData/codebase-memory-mcp), and [`serena`](https://github.com/oraios/serena).
- Generalization: [`@samchon/graph`](https://github.com/samchon/graph), the multi-language successor that carries the same one-tool contract to other languages.
- Function calling harness: [part 1, validation feedback](https://dev.to/samchon/qwen-meetup-function-calling-harness-from-675-to-100-3830) and [part 2, CoT compliance](https://dev.to/samchon/function-calling-harness-2-cot-compliance-from-991-to-100-4f0h), the typia technique the contract is built on.
- Protocol: the [Model Context Protocol](https://modelcontextprotocol.io).
- Validation & MCP surface: [`typia`](https://github.com/samchon/typia) and [`@typia/mcp`](https://github.com/samchon/typia).
