# Graph Benchmark

[benchmarks/graph/README.md](../../../benchmarks/graph/README.md) documents fixtures, comparators, prompts, the trace audit, and commands. A graph product change also follows [the graph contract](../project/graph.md).

- Keep fixtures outside the checkout under plain project names such as `vue@graph`. A fixture's `graph` branch uses a `tsconfig.graph.json` that includes tests.
- Record each comparator's setup time. Shell reads in a graph arm are measured behavior; exclude only zero-token infrastructure failures.
- Never run two `vscode` cells at once.
- Use `--reset` only to rebuild the whole dashboard. Keep `runs: 1` per cell, and key published cells in `TtscBenchmarkGraphWebsiteCell.ts` only by fields the website renders.
