# `@ttsc/graph`

![banner of @ttsc/graph](https://ttsc.dev/og-graph.png)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/graph) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/graph` is an MCP server that gives AI agents a code graph instead of source files.

It indexes a TypeScript codebase into a graph of declarations and their relationships, and answers an agent's code questions from that index through a single tool. Every node and edge is resolved by the TypeScript compiler itself, so the graph is exact for TypeScript and TSX, never text-guessed.

Coding agents normally answer a code question by grepping the repository and reading file after file into context, and that reading is most of the token bill. The graph removes the need for it, and its own answers stay small in turn: they carry names, signatures, relationships, and source spans, never file bodies.

Since neither side of that exchange grows with the repository, the cost falls by about the same proportion in every situation, on every codebase, for an agent that trusts the graph result enough to stop there. codex/gpt-5.4-mini does; see the [Benchmark](#benchmark) section below for a harness where a model doesn't, and reads on top of the graph call anyway. That even distribution is what separates this from [`codegraph`](https://github.com/colbymchenry/codegraph) and [`serena`](https://github.com/oraios/serena) when it holds, and it shows directly in the chart below:

![Agent token cost, common question, per repository](https://ttsc.dev/benchmark/svg/graph-common-codex-gpt-5.4-mini.svg)

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

Start the client from the project root. The server builds one resident graph and answers every MCP call from memory.

`@ttsc/graph` reads the graph from the program `ttsc` type-checked, so the project needs `ttsc` and `typescript` installed alongside it. `ttsc` runs on the native TypeScript 7 compiler from the `typescript` package; it does not run on the legacy TypeScript v6.x compiler. There is no separate index step and no static-parser fallback: the graph is a byproduct of the type-check the compiler already runs, or it is not built at all.

## Benchmark

Each repository is measured with one headless agent run per arm (`baseline` with no MCP, `@ttsc/graph`, `codegraph`, `serena`) on two prompt families, across two agent CLIs (`codex` and Claude Code). The corpus pins eight real TypeScript repositories.

### Common

Every repository is asked the same onboarding question, a plain code tour with no tool guidance appended. Across the corpus, `@ttsc/graph` holds a flat, low median token cost while the alternatives swing with repository size.

### Dedicated

`codegraph`'s own per-repository questions, verbatim, one architecture question per project.

The interactive charts, every model, and the method are on the benchmark page: https://ttsc.dev/docs/benchmark/graph

## How it works

```ts
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
```

> [`packages/graph/src/structures/ITtscGraphApplication.ts`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphApplication.ts)

### Chain of thought

`question`, `draft`, and `review` are required fields, so the model writes its reasoning into the call itself: state the question, draft the smallest request, then review the draft. A prompt line can be ignored; a required field cannot.

The review is allowed to overturn the draft, and that matters more than the planning. When an agent like Claude Code enters the tool with a question the graph cannot answer, `review` replaces the drafted request on the spot, and `escape` backs out entirely. A wrong entry costs one small call instead of a derailed session.

### Precision over restriction

Nothing is forbidden. The tool description says when the graph applies and when to stop. Grep and file reads stay available, and the agent still uses them when they are the right move.

What keeps the agent on the graph is precision. Answers carry names, signatures, edges, and spans resolved by the TypeScript compiler, so the agent accepts them as final instead of re-verifying with its own reads. And since no file body is ever included, a large repository cannot inflate the response.

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
