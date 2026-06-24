# `@ttsc/graph`

![banner of @ttsc/graph](https://ttsc.dev/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/graph) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

Gives your AI coding assistant a **graph of your codebase**, so it can answer "how does this work?" without opening file after file.

Ask an AI agent (Claude Code, Codex, and the like) about your project and it pokes around: it opens a file, follows an import, opens another, and keeps going.

`@ttsc/graph` hands it the graph up front: what calls what, what depends on what, and where each thing lives.

The graph comes from the real TypeScript compiler, so it is exact, not a guess from skimming text.

## What your agent gets

Say you ask: _"how does the editor draw a shape?"_

Instead of reading a dozen files, your agent looks it up once and gets back something like this:

```
ShapeRenderer (src/render/shape.ts, line 18)
  → calls    rasterize(), new Canvas()
  ← used by  Editor
  change it and 9 other things are affected
  18  export class ShapeRenderer {
  19    constructor(private canvas: Canvas) {}
  ...
```

One lookup shows what the symbol calls, what uses it, and its source.

Because the answer comes from the compiler, it is precise. When one file only re-exports something from another, the graph still points to the file that really defines it.

Code from `node_modules` is left out, since that is not your code.

On a public benchmark, a Claude agent answered while reading zero files, cutting its token use by **77% to 86%** and its tool calls by **94% to 95%**. See the [benchmark](https://ttsc.dev/docs/benchmark/graph) for the full numbers.

You can also browse the whole graph in 3D. This is TypeORM rendered as a navigable ontology, colored by declaration kind and edge kind (open the [live viewer](https://ttsc.dev/docs/graph/viewer) to orbit it):

[![The TypeORM code graph rendered in 3D](https://ttsc.dev/graph/typeorm-preview.png)](https://ttsc.dev/docs/graph/viewer)

## Install

```bash
npm install -D ttsc @ttsc/graph typescript@rc
```

`@ttsc/graph` runs through `ttsc`, so install the two together, the same way you would `@ttsc/lint`. There is nothing else to set up: no separate compiler, no Go.

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
| `graph_explore` | Look up a name or a file, and get back what it connects to (what it calls, what uses it, its types) along with its source code. |
| `graph_diagnostics` | Get the errors in one file: TypeScript type errors, plus your project's `@ttsc/lint` and plugin findings, exactly as `ttsc` reports them. |

You never call these yourself. Your agent uses them when it needs to.

Claude Code does this on its own. Codex is more cautious with third-party MCP tools and often explores with the shell instead, so tell it directly: add a line to your `AGENTS.md` asking it to call `graph_explore` first. See the [setup guide](https://ttsc.dev/docs/setup#codex-and-other-tool-conservative-agents).

## How it works

`ttsc` already type-checks your project with the real TypeScript compiler and keeps the result in memory. `@ttsc/graph` reads the graph straight out of that, so every connection it shows is the compiler's own answer, not a guess.

That is why it is exact, and why it is fast: nothing is recompiled to answer a question.

## References

`@ttsc/graph` is inspired by [codegraph](https://github.com/colbymchenry/codegraph), which gives agents a code graph over MCP. The [benchmark](https://ttsc.dev/docs/benchmark/graph) here is a faithful port of codegraph's.

The difference is how the graph is built. codegraph reads your code with tree-sitter across many languages and stores the result in a database it keeps in sync as files change, so its edges are a best guess from the syntax.

`@ttsc/graph` is TypeScript-only and keeps no database. It reads the graph live from the program `ttsc` already type-checked in memory. So every edge is the compiler's own answer: a re-export is followed to the file that really defines the symbol, an external library is left out, and nothing is guessed.
