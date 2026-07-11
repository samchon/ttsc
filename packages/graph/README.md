# `@ttsc/graph`

![banner of @ttsc/graph](https://ttsc.dev/og-graph.png)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/graph) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/graph` is an MCP server that gives your coding agent a graph of your TypeScript codebase instead of source files: what calls what, what depends on what, and where each piece lives.

It is built on the TypeScript compiler, `tsgo`. Every declaration, signature, and edge in the graph is resolved by the real type checker, for TypeScript and TSX only, and the agent asks its code questions through a single tool. A fact is in the graph because the compiler resolved it, not because a text parser guessed at it, so every claim is anchored to a file and line you can open.

Coding agents normally answer a code question by grepping the repository and reading file after file into context, and that reading is most of the token bill. The graph removes the need for it, and its own answers stay small in turn: they carry names, signatures, relationships, and source spans, never file bodies.

Since neither side of that exchange grows with the repository, the cost falls by about the same proportion on every codebase, for an agent that trusts the graph result enough to stop there. That even distribution is what separates it from `codegraph` and `serena`, whose token cost swings with repository size, and it shows in the chart below:

![Common prompt median token use on Codex GPT-5.4 Mini](https://ttsc.dev/benchmark/svg/graph-common-codex-gpt-5.4-mini.svg)

On open-ended "how does this work?" questions, that comes to roughly 10x fewer tokens. For why I built it, how it works in depth, and how it compares to `codegraph`, `codebase-memory-mcp`, and `serena`, read the launch post: https://ttsc.dev/blog/i-made-ts-compiler-graph-mcp

## Setup

```bash
npm install -D ttsc @ttsc/graph typescript
```

`@ttsc/graph` reads the graph from the program `ttsc` type-checked, so install the two together. `ttsc` runs on the native TypeScript 7 compiler from the `typescript` package. It does not run on the legacy TypeScript v6.x compiler.

Add the server to your agent's MCP config, once. For Claude Code, that is a `.mcp.json` in your project root:

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

Start your agent from your project root so the server finds your `tsconfig.json`. The agent queries the graph on its own; you never call it by hand.

The example says Claude Code, but any MCP-capable agent works (Codex, Cursor, and others).

## Benchmark

Each repository is measured with one headless agent run per arm (`baseline` with no MCP, `@ttsc/graph`, `codegraph`, `serena`) across two prompt families: a shared onboarding tour, and `codegraph`'s own per-repository questions.

Across eight real repositories, `@ttsc/graph` holds a flat, low median token cost while the alternatives swing with repository size. The savings land at about the same proportion on every repository, the property that separates it from `codegraph` and `serena` when it holds.

The interactive charts, every model, and the method are on the benchmark page: https://ttsc.dev/docs/benchmark/graph

## How it works

The whole MCP surface is one tool, `inspect_typescript_graph`. You ask in plain language, and a required chain of thought inside the call (`question`, `draft`, `review`) plans the smallest query and picks one operation.

![The forced chain of thought inside one tool call](https://ttsc.dev/blog/images/cot-pipeline.svg)

Here is the entire contract, the JSDoc the model actually reads and all:

```ts
/**
 * ## Graph
 *
 * - `inspect_typescript_graph`: a type-checker-resolved graph of your TypeScript
 *   project, not text guesses.
 * - Returns declarations, signatures, edges (calls, extends, references),
 *   decorators, tests, and source spans.
 * - The graph does not change until you edit the source. Until then every
 *   returned fact is complete compiler truth: trust it, and never re-verify
 *   with a file or another call.
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
 * - `escape` when the graph answered, or the need is outside it (source body
 *   text, non-TypeScript files, exact search).
 * - Only a source edit changes the graph. Until you edit, one call fully answers
 *   the question; after an edit, earlier facts no longer hold, so call again.
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
  ): Promise<ITtscGraphApplication.IResult>;
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
  export interface IResult {
    /**
     * Read first: an unedited compiler result is complete and errorless, so on
     * a returned result, answer and re-verify nothing.
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
```

> [`packages/graph/src/structures/ITtscGraphApplication.ts`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphApplication.ts)

### Chain of thought

`question`, `draft`, and `review` are required fields, so the model writes its reasoning into the call itself: state the question, draft the smallest request, then review the draft. A prompt line can be ignored; a required field cannot.

The review is allowed to overturn the draft, and that matters more than the planning. When the agent enters the tool with a question the graph cannot answer, `review` replaces the drafted request on the spot, and `escape` backs out entirely. A wrong entry costs one small call instead of a derailed session.

### Precision over restriction

Nothing is forbidden. The tool description says when the graph applies and when to stop, and grep and file reads stay available for the moments they are the right move.

What keeps the agent on the graph is precision. Answers carry names, signatures, edges, and spans resolved by the type checker, so the agent accepts them as final instead of re-verifying with its own reads. And since no file body is ever included, a large repository cannot inflate the response. A returned span is a citation, not a cue to open the file.

### Always current

Before each operation the server checks the config, root-file set, module-resolution inputs, and source contents. Unchanged calls reuse the warm graph; source edits update the resident compiler incrementally; config, file-addition, deletion, and resolution changes reload safely. The graph does not change until you edit the source, so within one session a returned fact stays true.

### Comparison

[`serena`](https://github.com/oraios/serena) and [`codegraph`](https://github.com/colbymchenry/codegraph) fight the agent instead:

- dozens of tools around one graph, so the agent often picks the wrong entry point
- long injected instructions, spent mostly on forbidding grep and file reads
- source snippets inlined into answers, which reintroduces the reading cost a graph exists to remove
- loosely structured answers the agent does not trust, so it goes back to reading the files to verify them
- no way to back out, so a wrong entry keeps paying tool calls instead of escaping

Here the same policy fits in one typed contract, enforced by schema instead of pleaded for in prose.

The operations (`tour`, `entrypoints`, `lookup`, `trace`, `details`, `overview`, `escape`) and the full request and result contract are in the design guide: https://ttsc.dev/docs/graph/design

## Browse it in 3D

Run this in your own project to open the graph in your browser, served from a local port:

```bash
npx @ttsc/graph view
```

This is TypeORM in 3D, colored by kind ([live viewer](https://ttsc.dev/docs/graph/viewer)):

[![The TypeORM code graph rendered in 3D](https://ttsc.dev/graph/typeorm.png)](https://ttsc.dev/docs/graph/viewer)

## Learn more

- [Launch post](https://ttsc.dev/blog/i-made-ts-compiler-graph-mcp): why I built it, and how it compares to `codegraph`, `codebase-memory-mcp`, and `serena`.
- [Design](https://ttsc.dev/docs/graph/design): the one tool, its request and result branches, and the node and edge kinds.
- [Comparison](https://ttsc.dev/docs/graph/compare): the head-to-head with other graph and language-server MCP tools.
- [Benchmark](https://ttsc.dev/docs/benchmark/graph): the interactive charts, every model, and the method.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
