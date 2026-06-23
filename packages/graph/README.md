# `@ttsc/graph`

![banner of @ttsc/graph](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/graph) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Gives your AI coding assistant a **map of your codebase**. It can answer "how does this work?" without opening file after file.

When you ask an AI agent (Claude Code, Codex, and the like) about your project, it pokes around. It opens a file, follows an import, opens another, and on and on.

`@ttsc/graph` hands it the map up front: what calls what, what depends on what, and where each thing lives.

The map comes from the real TypeScript compiler. So it is exact — not a guess from skimming text.

## What your agent gets

Say you ask: _"how does the editor draw a shape?"_

Your agent looks it up once instead of reading a dozen files, and gets back something like this:

```
ShapeRenderer — src/render/shape.ts (line 18)
  → calls    rasterize(), new Canvas()
  ← used by  Editor
  change it and 9 other things are affected
  18  export class ShapeRenderer {
  19    constructor(private canvas: Canvas) {}
  ...
```

One step shows what this thing calls, what uses it, and its source.

The answer comes from the compiler, so it is precise. When one file just re-exports something from another, the map still points at the file that really defines it.

Anything from `node_modules` is left out, because that is not your code.

On a public benchmark, the map cut an agent's token use by about **70%** and its tool calls by about **83%**. The agent stopped reading files almost entirely.

See the [benchmark](https://ttsc.dev/docs/graph/benchmark) for the full numbers.

## Install

```bash
npm install -D ttsc @ttsc/graph typescript@rc
```

Install `ttsc` alongside it. `@ttsc/graph` runs through `ttsc`, so the two go together — the same pair as `@ttsc/lint`.

There is nothing else to set up: no separate compiler, no Go.

## Connect it to your agent

Add this to your AI tool's config once. For Claude Code, that is a `.mcp.json` file in your project:

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

Start your agent from your project folder so it finds your `tsconfig.json`.

Your agent now has two new abilities:

| Ability | What it does |
| --- | --- |
| `graph_explore` | Look up a name or a file. Get back what it connects to — what it calls, what uses it, its types — and its source code. |
| `graph_diagnostics` | Get the TypeScript errors in one file, exactly as `tsc` reports them. |

You never call these yourself. Your agent uses them when it needs to.

## How it works

`ttsc` already type-checks your project with the real TypeScript compiler and keeps the result in memory.

`@ttsc/graph` reads the map straight out of that. Every connection it shows is the compiler's own answer, not a guess.

That is why it is exact, and why it is fast: nothing is recompiled to answer a question.

## References

`@ttsc/graph` is inspired by [codegraph](https://github.com/colbymchenry/codegraph), which gives agents a code graph over MCP. The [benchmark](https://ttsc.dev/docs/graph/benchmark) here is a faithful port of codegraph's.

The difference is how the map is built.

codegraph reads your code with tree-sitter, across many languages, and saves the result in a database it keeps in sync as files change. Its edges are a best guess from the syntax.

`@ttsc/graph` is TypeScript-only and keeps no database. It reads the graph live from the program `ttsc` already type-checked in memory.

So every edge is the compiler's own answer: a re-export is followed to the file that really defines the symbol, an external library is left out, and nothing is guessed.
