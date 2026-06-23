# `@ttsc/graph`

![banner of @ttsc/graph](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/graph) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Gives your AI coding assistant a **map of your codebase**, so it can answer "how does this work?" without opening file after file.

When you ask an AI agent (like Claude Code or Codex) about your project, it normally pokes around — opens a file, follows an import, opens another, and on and on. `@ttsc/graph` hands it the map up front: what calls what, what depends on what, and where each thing lives. The map comes from the actual TypeScript compiler, so it is correct — not a guess from skimming text.

## What your agent gets

Say you ask: _"how does the editor draw a shape?"_ Instead of reading a dozen files, your agent looks it up once and gets back something like this:

```
ShapeRenderer — src/render/shape.ts (line 18)
  → calls    rasterize(), new Canvas()
  ← used by  Editor
  change it and 9 other things are affected
  18  export class ShapeRenderer {
  19    constructor(private canvas: Canvas) {}
  ...
```

In one step it sees what this thing calls, what uses it, and its source. Because the answer comes from the compiler, even when one file just forwards something from another, the map points at the file that really defines it — and anything from `node_modules` is left out, because that is not your code.

On a public benchmark, giving an agent this map cut its token use by about **70%** and its tool calls by about **83%** — it stopped reading files almost entirely. See the [benchmark](https://ttsc.dev/docs/graph/benchmark) for the full numbers.

## Install

```bash
npm install -D ttsc @ttsc/graph typescript@rc
```

Install `ttsc` next to it: `@ttsc/graph` runs through `ttsc`, so the two go together (the same pair as `@ttsc/lint`). There is nothing else to set up — no separate compiler, no Go.

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

Start your agent from your project folder so it finds your `tsconfig.json`. Now your agent has two new things it can do:

| Ability | What it does |
| --- | --- |
| `graph_explore` | Look up a name or a file and get back what it connects to — what it calls, what uses it, its types — and its source code. |
| `graph_diagnostics` | Get the TypeScript errors in one file, exactly as `tsc` reports them. |

You never have to touch these directly; your agent calls them when it needs to.

## How it works

`ttsc` already type-checks your project with the real TypeScript compiler and keeps the result in memory. `@ttsc/graph` simply reads the map out of that — so every connection it shows is the compiler's own answer, not a guess. That is why it is exact, and why it is fast: nothing is recompiled to answer a question.
