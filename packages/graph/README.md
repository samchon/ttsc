# `@ttsc/graph`

![banner of @ttsc/graph](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/graph) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Ask your coding agent how a TypeScript project works and you know what happens: it opens a file, follows an import, opens another, and a dozen files later it answers. The crawl is slow, token-hungry, and every relationship is a guess read off the text.

`@ttsc/graph` gives the agent a **graph of your codebase** instead, over MCP: what calls what, what depends on what, where each piece lives. It is drawn by the real TypeScript compiler, so it is exact, not skimmed. The agent answers from the graph, and every claim is anchored to a file and line the compiler resolved, so you can open the spot and check it.

Plenty of tools replace that crawl. Cutting the agent's tool calls is the easy part; cutting its tokens too is harder, and cutting them without the answer getting any worse is harder still. That last problem is the one `@ttsc/graph` is built for: on a public benchmark it cuts an agent's tokens by roughly 10x on open-ended "how does this work?" questions. See the [Benchmark](#benchmark) section below.

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

Run this in your own project to open the graph in your browser, served from a local port:

```bash
npx @ttsc/graph view
```

This is TypeORM in 3D, colored by kind ([live viewer](https://ttsc.dev/docs/graph/viewer)):

[![The TypeORM code graph rendered in 3D](https://ttsc.dev/graph/typeorm.png)](https://ttsc.dev/docs/graph/viewer)

## Why I Built It

I did not invent this. [`codegraph`](https://github.com/colbymchenry/codegraph) put a code graph in front of an agent over MCP first; [`codebase-memory-mcp`](https://github.com/DeusData/codebase-memory-mcp) does the same across 158 languages, headlining "120x fewer tokens." Their core claim is legit: the enemy is the agent's grep, find, and Read crawl loop, and replacing it with one graph query is a real win. So I installed them.

It did not go well. Tokens did not drop. On some repositories the agent spent more than it did with no MCP at all. Claude Code and Codex did not get smarter, and kept missing the intent. Useless tool calls fired constantly and blocked the work I wanted done. And I could not just ask in plain language: `codebase-memory-mcp` wants a Cypher query with an exact `qualified_name`, and `codegraph` wants you to name the symbols for a flow.

So I went digging. Two things explained it.

### What the tool returns

A query has to come back as something. `codegraph` returns whole source bodies, "the Read, done for you." That is fine for editing, but for a broad "how does this work?" the body is the token bomb, and past a dozen files it truncates and asks you to call again. `codebase-memory-mcp` is the more interesting case. Under the hood it has a real relation graph, much like the one here: call chains, dependencies, cross-service links. But the capability is spread across fourteen MCP tools, and the useful ones want a Cypher query or an exact `qualified_name`. In the benchmark the agent never reached it: it called the MCP zero times and went to the shell instead. The graph was there; the surface buried it.

Two different failures: one hands back too much, the other keeps the right thing behind a door the agent never opens. Neither lets it answer cheaply.

![What each tool hands back](https://ttsc.dev/blog/response-shapes.svg)

### Whether it forces itself

The other half is the instructions, and the two go opposite ways. `codegraph` forces its tool: its MCP instructions tell the agent to use it instead of reading files, to call it before any Read, and to reach for it on almost any question. So calls fire even when the graph is not the answer, for a config, a small edit, or a question it cannot answer, and those calls block real work. `codebase-memory-mcp` does the reverse: its MCP initialize sends no instructions at all, so with fourteen tools and little to say which to use when, the agent mostly never engaged it. One over-directs, one under-directs.

To their credit, both are upfront about the limits: `codegraph` notes its token savings are scale-dependent and that it is overhead unless queried directly, and `codebase-memory-mcp` reports its biggest numbers on structural queries, not open-ended ones. Those limits grow the more general the use, which is the case `@ttsc/graph` was built for. These two are the pioneers that put a code graph in front of an agent at all; this one just learns from where they ran into a wall.

For the full version of this story, read the [launch post](https://ttsc.dev/blog/graph).

## How It Works

`@ttsc/graph` is built to avoid each of those.

### Built on the real TypeScript compiler

`@ttsc/graph` reads the graph from the program `ttsc` already type-checked. Because the compiler finished module resolution, the graph is exact: `tsconfig` path aliases (`@app/*`), pnpm monorepo cross-package references, symlinks, and re-export chains all resolve correctly. A parser that only reads text, such as tree-sitter, has to infer these, and a guessed edge is where an agent stops trusting the result and goes back to reading files.

The graph falls out of the type-check that already runs, so there is no separate index step, no file watcher, and no stale index to manage.

### An index, not source bodies

A query returns names, edges, signatures, and source spans, and never inlines source bodies. The edges and signatures are the relationships themselves, so the agent assembles the answer without opening a file.

Two things follow. The response is bounded independent of repo size, so the token cost stays flat whether the project is ten thousand lines or a million. And every span is a citation: a file and line the compiler resolved, which you can open to verify.

### One tool, asked in plain language

The whole MCP surface is a single tool. A capable graph is no use if the agent cannot reach it, which is the failure that buried `codebase-memory-mcp`'s, so one tool removes that choice entirely. You ask in plain language ("how does this project work?"), and a guided request inside the tool turns that into the right graph operation. There are no symbol names, query languages, or schemas for you to learn.

![The guided request inside one tool call](https://ttsc.dev/blog/cot-pipeline.svg)

The request carries a short, required chain of thought (`question`, `draft`, `review`) before it runs, so the model plans the smallest query and can correct or bail out first. It is built with [typia](https://typia.io), whose function-calling harness compiles the TypeScript type into the tool schema and validator. The single source of truth for the whole surface, including the descriptions the model reads, is [`ITtscGraphApplication.ts`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphApplication.ts).

The request resolves to one of these operations. You do not pick them by hand; the guided request does.

- [`tour`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphTour.ts): a broad code tour. Answers "new project, how does it work?" in one response.
- [`entrypoints`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphEntrypoints.ts): where to start reading.
- [`lookup`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphLookup.ts): find a symbol by name.
- [`trace`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphTrace.ts): trace a call or data flow, forward or by impact radius.
- [`details`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphDetails.ts): a symbol's signature, members, and neighbors.
- [`overview`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphOverview.ts): a repo-level overview.
- [`escape`](https://github.com/samchon/ttsc/blob/master/packages/graph/src/structures/ITtscGraphEscape.ts): a no-op exit when the graph is not the right source.

### It does not force itself on the agent

`@ttsc/graph` never tells the agent to call it instead of reading files. It states when the graph is the right source (questions about TypeScript symbols, calls, and types) and offers a first-class `escape` for everything else (configs, docs, exact-text search). The one firm rule is that a returned fact is compiler truth and does not need re-checking by reading files. Calls fire when the graph helps, and not otherwise.

### Compile errors and lint findings, in the same graph

The graph also carries `tsc` compile errors plus `@ttsc/lint` and plugin (typia, nestia) lint findings, each fused onto the symbol that owns it. So "what is broken here?" and "what breaks if I change this?" come from the same index as the structure.

## Benchmark

On the current GPT 5.4 Mini snapshot, the published median token cost is lowest with `@ttsc/graph`.

![Common prompt median token use on Codex GPT-5.4 Mini](https://ttsc.dev/benchmark/graph-common-codex-gpt-5.4-mini.svg)

The benchmark runs two prompt families across eight real repositories: a common onboarding question, and the per-repo questions from `codegraph`, whose benchmark this ports. `codebase-memory-mcp`'s own prompts would have made a third, but it ships no reproducible method, so they are not included. `@ttsc/graph` holds a flat, low token cost, while the other tools swing with repo size and sometimes land above the no-MCP baseline. See the [full benchmark page](https://ttsc.dev/docs/benchmark/graph) for the raw rows and method.

## Requirements

- A TypeScript project with a `tsconfig.json`. `@ttsc/graph` is TypeScript only. On a project without a TypeScript program there is no graph to serve, and the agent will not lean on the tool.
- `ttsc` and `typescript@rc`, the TypeScript-Go (v7) release candidate. It does not run on stable TypeScript v6.x yet.

## Sponsors

[![Sponsors](https://raw.githubusercontent.com/samchon/sponsor-images/refs/heads/master/public/circle.svg)](https://github.com/sponsors/samchon)

Thanks for your support.

Your [donation](https://github.com/sponsors/samchon) encourages `ttsc` development.

## References

`@ttsc/graph` is inspired by [`codegraph`](https://github.com/colbymchenry/codegraph), which first put a code graph in front of an agent over MCP. The [benchmark](https://ttsc.dev/docs/benchmark/graph) here is a faithful port of `codegraph`'s.

The difference is where the graph comes from. `codegraph` parses the shape of your code and infers how the pieces connect, while `@ttsc/graph` asks the real TypeScript compiler, which has already resolved every import and reference, so the graph is exact rather than inferred.

See also [`codebase-memory-mcp`](https://github.com/DeusData/codebase-memory-mcp), which explores the same idea across 158 languages.
