# @ttsc/graph benchmark

Two benchmarks, mirroring the two codegraph publishes: a structural one (`bench.mjs`, coverage and counts) and an agent-cost A/B (`agent-ab.mjs`, "X% cheaper / fewer tokens").

## Structural benchmark (`bench.mjs`)

Measures `@ttsc/graph` on a real project, the way codegraph reports coverage: how long the resident `Program` takes to load, how cheap graph extraction is on top of that already-built `Program`, the node and edge counts, and the "fair coverage" (share of symbol-bearing source files with at least one resolved cross-file edge).

The counts and coverage are deterministic. The timings are indicative and only trustworthy on a quiet host (see `.codex/skills/benchmark`); a CI run shows the shape, not a publishable figure.

### Run

```bash
# Default target: packages/ttsc (this repo's launcher source)
node experimental/graph-bench/bench.mjs

# Any project, with run count
node experimental/graph-bench/bench.mjs --project=/abs/path/to/project --tsconfig=tsconfig.json --runs=5
```

It builds the `cmd/graphbench` metrics binary once, runs it `--runs` times (plus one warmup), and writes `report.json` next to this file.

### What it reports

A CI run against this repo's `packages/ttsc` (53 source files) reported:

```
Result (counts deterministic; timings indicative):
  source files:  53
  nodes:         575 (66 external boundary leaves)
  edges:         1402 (heritage 2, value-call 1016, type-ref 384)
  fair coverage: 92.2% (47/51 symbol-bearing files cross-linked)
  load time:     81 ms (median)
  graph build:   37 ms (median), 45.7% on top of the load it rides
```

Read the coverage as the codegraph-style flex: 92.2% of symbol-bearing files have at least one checker-resolved cross-file edge. The `graph build ... % on top of the load it rides` line is honest about cost: on a small project the walk is a real fraction of the (already fast) load, and the ratio shrinks as type-checking dominates on larger trees. The point is not that extraction is free, but that it rides the `Program` the compiler already built, so the server answers queries without a second compile or an external language-server round-trip.

## Agent-cost A/B (`agent-ab.mjs`)

A faithful port of codegraph's headline benchmark (its `scripts/agent-eval`). For codegraph's verbatim question per repo it runs the Claude Code CLI headless twice, once with the `@ttsc/graph` MCP server and once with an empty MCP config, both under `--strict-mcp-config`, and reports codegraph's metrics: tokens summed per assistant turn (not last-turn `result.usage`), tool-call count, cost, and wall time, median over N runs. Only codegraph's two TypeScript repos are runnable by a checker-resolved graph, `excalidraw` and `vscode` (the other five are Python/Rust/Java/Go/Swift). It spends real Claude credits, is non-deterministic, and is not wired into CI. Requires `claude` and `go` on `PATH`.

```bash
node experimental/graph-bench/agent-ab.mjs --repo=excalidraw --runs=4
node experimental/graph-bench/agent-ab.mjs --repo=vscode --runs=4 --model=opus
```

Median of 3 runs on `excalidraw`, codegraph's question "How does Excalidraw render and update canvas elements?", Sonnet:

```
                graph vs empty-MCP baseline
  tokens        354,126 vs 1,730,912   80% saved
  tool calls    4       vs 45          91% saved
  cost          $0.170  vs $0.280      39% saved
  wall time     51s     vs 169s        70% saved
```

In all three graph runs the agent read zero files (`read 0, grep 0`): it answered from graph_explore alone. This is on codegraph's own harness, question, metrics, and empty-MCP baseline, and exceeds codegraph's reported headline (16% cheaper, 47% fewer tokens, 58% fewer tool calls). The unlock was lazy-init: the server must answer the MCP handshake before it finishes type-checking the project, or it sits "pending" with no tools advertised and the agent falls back to grep. Numbers move with model and repo; take a larger median for a published figure.
