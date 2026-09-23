# Graph Benchmark

Read this document through the benchmark skill before running or changing the graph harness, its prompts or fixtures, trace auditing, comparator setup, or `website/public/benchmark/graph.json` publication. [benchmarks/graph/README.md](../../../benchmarks/graph/README.md) is the runner reference for fixtures, the run, comparator setup, the prompt corpus, the trace audit, commands, flags, environment overrides, and outputs. This document holds only the rules a change must keep. A change to the graph product itself also follows the [project skill's graph contract](../project/graph.md#measuring-a-change).

## Measurement Rules

- Keep fixtures outside the ttsc checkout, as the README explains, and name them with the plain agent-visible project name such as `vue@graph`, never a harness-oriented prefix.
- A fixture's `graph` branch uses `tsconfig.graph.json`, which includes source and tests, never an emit-only build config. A test-less program sends the agent searching the filesystem for tests and changes the workload.
- Record each comparator's setup time. The setup itself follows the benchmark skill's [Measurement Integrity](SKILL.md#measurement-integrity) rules.
- Shell source reads in a graph arm are measured behavior. Exclude only zero-token infrastructure or capacity failures from published results.
- VS Code is a global single lane: never run two `vscode` cells concurrently, though other projects may run beside one.

## Publishing

- Do not add `--reset` to an ordinary refresh. Use it only when intentionally rebuilding the entire graph dashboard in the same publication sequence.
- The public dashboard stores one run per cell on the selected mid-size model tiers, and repository breadth is the sample. Preserve `runs: 1` in the website JSON and do not average a bad cell away; this differs from the performance benchmark's multi-run sampling.
- `benchmarks/graph/src/TtscBenchmarkGraphWebsiteCell.ts` is the single published-cell key. Key only by fields the website renders, so metadata such as fixture branch, reasoning effort, or setup time never creates a second visible copy of a cell.
