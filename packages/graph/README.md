# `@ttsc/graph`

![banner of @ttsc/graph](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/graph) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Gives your AI coding agent a **graph of your TypeScript codebase**, over MCP, so it answers "how does this work?" without opening file after file.

Ask an agent like Claude Code or Codex about your project and it works file by file: open one, follow an import, open the next, until it has pieced the picture together by hand. That crawl is slow, token-hungry, and every relationship is a guess read off the text.

`@ttsc/graph` hands the agent the graph up front: what calls what, what depends on what, where each piece lives. It is drawn by the real TypeScript compiler, so it is exact, not skimmed. The agent answers from the graph, and every claim is anchored to a file and line the compiler resolved, so you can open the spot and check it.

On a public benchmark, `@ttsc/graph` cuts an agent's tokens by roughly 10x on open-ended "how does this work?" questions. See the [benchmark](https://ttsc.dev/docs/benchmark/graph).

You can also browse the whole graph. This is TypeORM in 3D, colored by kind ([live viewer](https://ttsc.dev/docs/graph/viewer)):

[![The TypeORM code graph rendered in 3D](https://ttsc.dev/graph/typeorm.png)](https://ttsc.dev/docs/graph/viewer)

## Setup

### Install

```bash
npm install -D ttsc @ttsc/graph typescript@rc
```

`@ttsc/graph` reads the graph from the program `ttsc` type-checked, so install the two together. `ttsc` runs on the TypeScript-Go (TypeScript v7) runtime, which is still a release candidate, so the install pins `typescript@rc`. It does not run on stable TypeScript v6.x yet.

### Connect your agent

Add the server to your agent's MCP config, once.

For Claude Code, that is a `.mcp.json` in your project root:

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

Start your agent from your project root so the server finds your `tsconfig.json`. The agent queries the graph on its own; you never call it by hand. The example says Claude Code, but any MCP-capable agent works (Codex, Cursor, and others).

### Browse it in 3D

Run this in your own project to open that 3D graph in your browser, served from a local port:

```bash
npx @ttsc/graph view
```

## Why @ttsc/graph

### Built on the real TypeScript compiler

`@ttsc/graph` reads the graph from the program `ttsc` already type-checked. Because the compiler finished module resolution, the graph is exact: `tsconfig` path aliases (`@app/*`), pnpm monorepo cross-package references, symlinks, and re-export chains all resolve correctly. A parser that only reads text, such as tree-sitter, has to infer these, and a guessed edge is where an agent stops trusting the result and goes back to reading files.

The graph falls out of the type-check that already runs, so there is no separate index step, no file watcher, and no stale index to manage.

### An index, not source bodies

A query returns names, edges, signatures, and source spans. It never inlines source bodies. Two things follow from that.

The response is bounded independent of repo size, so the token cost stays flat whether the project is ten thousand lines or a million. And every span is a citation: a file and line the compiler resolved, which you can open to verify.

### One tool, asked in plain language

The whole MCP surface is a single tool. You ask in plain language ("how does this project work?"), and a guided request inside the tool turns that into the right graph operation. There are no symbol names, query languages, or schemas for you to learn.

![The guided request inside one tool call](https://ttsc.dev/blog/cot-pipeline.svg)

The request carries a short, required chain of thought (`question`, `draft`, `review`) before it runs, so the model plans the smallest query and can correct or bail out first. It is built with [typia](https://typia.io), whose function-calling harness compiles the TypeScript type into the tool schema and validator. The single source of truth for the whole surface is [`ITtscGraphApplication.ts`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphApplication.ts).

### It does not force itself on the agent

`@ttsc/graph` never tells the agent to call it instead of reading files. It states when the graph is the right source (questions about TypeScript symbols, calls, and types) and offers a first-class `escape` for everything else (configs, docs, exact-text search). The one firm rule is that a returned fact is compiler truth and does not need re-checking by reading files. Calls fire when the graph helps, and not otherwise.

### Compile errors and lint findings, in the same graph

The graph also carries `tsc` compile errors plus `@ttsc/lint` and plugin (typia, nestia) lint findings, each fused onto the symbol that owns it. So "what is broken here?" and "what breaks if I change this?" come from the same index as the structure.

For the full story, why other code-graph tools cut tool calls but not tokens and how this one is built, read the [launch post](https://ttsc.dev/blog/graph).

## Benchmark

On the current GPT 5.4 Mini snapshot, the published median token cost is lowest with `@ttsc/graph`.

![Common prompt median token use on Codex GPT-5.4 Mini](https://ttsc.dev/benchmark/graph-common-codex-gpt-5.4-mini.svg)

The prompts are open-ended questions run across eight real repositories. `@ttsc/graph` holds a flat, low token cost, while source-returning and pointer-returning tools swing with repo size and sometimes land above the no-MCP baseline. See the [full benchmark page](https://ttsc.dev/docs/benchmark/graph) for the raw rows and method.

## Request types

The single tool resolves to one of the operations below. You do not pick them by hand; the guided request does. They are listed here for reference, each linking to its request and result types.

- [`tour`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphTour.ts): a broad code tour. Answers "new project, how does it work?" in one response.
- [`entrypoints`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphEntrypoints.ts): where to start reading.
- [`lookup`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphLookup.ts): find a symbol by name.
- [`trace`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphTrace.ts): trace a call or data flow, forward or by impact radius.
- [`details`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphDetails.ts): a symbol's signature, members, and neighbors.
- [`overview`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphOverview.ts): a repo-level overview.
- [`escape`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphEscape.ts): a no-op exit when the graph is not the right source.

## Requirements

- A TypeScript project with a `tsconfig.json`. `@ttsc/graph` is TypeScript only. On a project without a TypeScript program there is no graph to serve, and the agent will not lean on the tool.
- `ttsc` and `typescript@rc`, the TypeScript-Go (v7) release candidate. It does not run on stable TypeScript v6.x yet.

## References

`@ttsc/graph` is inspired by [codegraph](https://github.com/colbymchenry/codegraph), which first put a code graph in front of an agent over MCP. The [benchmark](https://ttsc.dev/docs/benchmark/graph) here is a faithful port of codegraph's.

The difference is where the graph comes from. codegraph parses the shape of your code and infers how the pieces connect, while `@ttsc/graph` asks the real TypeScript compiler, which has already resolved every import and reference, so the graph is exact rather than inferred.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.
