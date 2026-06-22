# @ttsc/graph

A code-graph and diagnostics MCP server for coding agents, backed by `ttsc`'s in-process TypeScript-Go compiler.

`@ttsc/graph` launches `ttscgraph`, a Model Context Protocol server that builds one resident `Program` for your project and answers structural questions from that warm type checker. Every edge it reports is resolved by the real checker, not a syntactic guess: barrel re-exports, cross-package edges, and dependency boundaries are exact. A `node_modules` or `.d.ts` declaration is reported as an external boundary leaf and is not walked into.

On codegraph's own agent-cost benchmark, an agent answers an architecture question from the graph alone, reading zero files, for 80% fewer tokens and 91% fewer tool calls than the same agent without it. See the [benchmark](https://ttsc.dev/docs/graph/benchmark) for the numbers and method.

## When to use it

Point a coding agent at it when you want the agent to answer "what relates to this symbol", "what is the blast radius of this change", or "what are the type errors in this file" without re-reading and re-parsing source on every turn.

## Install

```bash
npm install -D ttsc @ttsc/graph typescript@rc
```

`@ttsc/graph` resolves the native `ttscgraph` binary from the `ttsc` platform package, so `ttsc` must be installed.

## Configure your agent

Add the server to your MCP client. For Claude Code:

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

Run it against a project by starting your agent from the project root, or pass `--cwd` and `--tsconfig`:

```bash
npx @ttsc/graph --cwd ./packages/app --tsconfig tsconfig.json
```

Usage guidance is delivered in the MCP `initialize` response. The server never writes into your `CLAUDE.md`, `AGENTS.md`, or other agent config files.

## Tools

- `graph_explore`: the primary tool. Given a symbol name or a file path fragment, returns the matching nodes and their checker-resolved relationships.
- `graph_diagnostics`: the tsc semantic diagnostics for one file, in the same code and location `tsgo` reports.

## Environment

- `TTSC_GRAPH_BINARY`: absolute path to a `ttscgraph` binary, overriding platform resolution.
