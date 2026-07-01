# `@ttsc/graph`

![banner of @ttsc/graph](https://ttsc.dev/og-graph.png)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE) [![NPM Version](https://img.shields.io/npm/v/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![NPM Downloads](https://img.shields.io/npm/dm/@ttsc/graph.svg)](https://www.npmjs.com/package/@ttsc/graph) [![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest) [![Guide Documents](https://img.shields.io/badge/Guide-Documents-forestgreen)](https://ttsc.dev/docs/graph) [![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

`@ttsc/graph` gives your coding agent a **graph of your TypeScript codebase** over MCP: what calls what, what depends on what, where each piece lives.

It is drawn by the real TypeScript compiler, so it is exact, and every claim is anchored to a file and line you can open.

The agent answers structural questions from the graph instead of crawling file by file, which cuts its tokens by roughly 10x on open-ended "how does this work?" questions.

For why I built it, how it works in depth, and how it compares to `codegraph`, `codebase-memory-mcp`, and `serena`, read the launch post: https://ttsc.dev/blog/i-made-ts-compiler-graph-mcp

## Setup

```bash
npm install -D ttsc @ttsc/graph typescript@rc
```

`@ttsc/graph` reads the graph from the program `ttsc` type-checked, so install the two together.

`ttsc` runs on the TypeScript-Go (TypeScript v7) runtime, which is still a release candidate, so the install pins `typescript@rc`. It does not run on stable TypeScript v6.x yet.

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

## How it works

The whole MCP surface is one tool, `inspect_typescript_graph`. You ask in plain language, and a short required chain of thought inside the tool (`question`, `draft`, `review`) plans the smallest query and picks one operation.

![The forced chain of thought inside one tool call](https://ttsc.dev/blog/images/cot-pipeline.svg)

- **An index, not source bodies.** It returns names, edges, signatures, and spans, never code, so the response stays flat as the repository grows.
- **Built on the real compiler.** It reads the program `ttsc` type-checked, so `tsconfig` aliases, pnpm monorepos, symlinks, and re-exports resolve exactly, where a text parser can only guess.
- **It does not force itself.** It states when the graph is the right source and offers a first-class `escape` for everything else.
- **Errors and lint too.** `tsc` compile errors and `@ttsc/lint` and plugin (typia, nestia) findings ride the same graph, so "what is broken here?" answers from one index.

The operations (`tour`, `entrypoints`, `lookup`, `trace`, `details`, `overview`, `escape`) and the full request and result contract are in the Design guide: https://ttsc.dev/docs/graph/design

## Benchmark

![Common prompt median token use on Codex GPT-5.4 Mini](https://ttsc.dev/benchmark/graph-common-codex-gpt-5.4-mini.svg)

Across eight real repositories, `@ttsc/graph` holds a flat, low median token cost while the alternatives swing with repository size.

The full benchmark has the interactive charts, every model, and the method: https://ttsc.dev/docs/benchmark/graph

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
