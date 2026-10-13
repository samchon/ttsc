---
name: benchmark
description: Runs, supervises, changes, and publishes ttsc's performance, graph, and evidence benchmarks under benchmarks/. Use before running, changing, or publishing any benchmark or its fixtures.
---

# Benchmark

| Work | Read |
| --- | --- |
| Performance harness and its fixture branches | [performance.md](performance.md) |
| Graph harness, prompts, comparators, and traces | [graph.md](graph.md) |
| Evidence campaign: launch, supervision, dashboard | [evidence/campaign.md](evidence/campaign.md) |
| Evidence: whether a cell's edit is allowed, and warning a cell | [evidence/integrity.md](evidence/integrity.md) |
| Evidence: a Plain cell's Review boundary | [evidence/review.md](evidence/review.md) |
| Evidence: fixing a repository defect mid-campaign | [evidence/boundary.md](evidence/boundary.md) |
| Evidence: a stopped, hung, or failed cell, or cancellation | [evidence/recovery.md](evidence/recovery.md) |
| Evidence: publishing results and closing the cohort | [evidence/aggregate.md](evidence/aggregate.md) |

The rules below cover the performance and graph harnesses; the evidence benchmark has its own documents.

- Measure the real product on the full workload, with every comparator set up as its own documentation prescribes. Never restrict an agent or skip input to improve a number.
- Inspect the raw report or trace behind any surprising result before accepting or explaining it.
- A CLI entry in `src/executable` only imports one `TtscBenchmark*` owner and calls `main()`, within 12 lines. Every other module exports one `TtscBenchmark*` class or namespace, or one `ITtscBenchmark*` interface with its companion namespace, from a file of that name, and never a standalone function, constant, enum, or type alias. Document each member's role and each field's unit and default. Run the README's strict type check before committing.
- Give each run its own temporary root, including `GOCACHE` and `GOTMPDIR`, and delete it afterwards unless `--keep-...` or the user says otherwise. Never clean a shared Go cache or temp directory.
- Edit fixtures in their own repositories, and push a fixture branch only when its build, format, and lint pass and it holds no generated benchmark input.
- Update the sticky result comment only with pull-request authority; otherwise put the table in the report.
