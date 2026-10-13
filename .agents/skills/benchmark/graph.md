# Graph Benchmark

[benchmarks/graph/README.md](../../../benchmarks/graph/README.md) documents fixtures, comparators, prompts, the trace audit, and commands.

- Keep fixtures outside the checkout under plain project names such as `vue@graph`. A fixture's `graph` branch uses a `tsconfig.graph.json` that includes tests.
- Prompts stay natural questions with no hidden graph guidance. People judge answer quality; the harness records only numbers such as tokens, calls, reads, and durations, never matched answer text.
- Record each comparator's setup time. Shell reads in a graph arm are measured behavior; exclude only zero-token infrastructure failures. Never run two `vscode` cells at once.
- A change to graph logic, its instruction, schema, tool descriptions, or runner text re-measures every `ttsc-graph` cell against the published `graph.json`. First diff old and new tours offline and predict each cell; then judge each cell on its own. A cell that loses reduction, adds calls, or newly reads files blocks merge until its trace explains the cause and the cause is fixed, and a result that contradicts the prediction calls for investigation or revert, not another patch.
- Use `--reset` only to rebuild the whole dashboard. Keep `runs: 1` per cell, and key published cells in `TtscBenchmarkGraphWebsiteCell.ts` only by fields the website renders.
