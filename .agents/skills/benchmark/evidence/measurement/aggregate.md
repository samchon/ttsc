# Aggregate

`benchmarks/evidence/aggregate` is what a campaign publishes and keeps. Like the dashboard it is generated from the retained record, so run the command and commit what it wrote.

## Publish

```bash
pnpm --filter @ttsc/benchmark-evidence audit-suspensions
pnpm --filter @ttsc/benchmark-evidence report
```

`report` writes the aggregate and its charts:

- `benchmarks/evidence/aggregate/summary.json`.
- Stable per-cell JSON under `benchmarks/evidence/aggregate/cells/<model>/<subject>/<arm>.json`.
- `website/public/benchmark/evidence/summary.svg`, every subject on one token axis under the coverage block.
- One `website/public/benchmark/evidence/<model>-<subject>.svg` per subject, carrying its tokens, work time, and API cost.

The aggregate holds the measurement and the charts are a rendering of it, so the charts live where they are served. `report` refuses to write when the collection is empty, because a checkout with no run tree would otherwise replace the tracked measurement with nothing.

Redraw the charts without collecting anything:

```bash
pnpm --filter @ttsc/benchmark-evidence charts
```

That reads `summary.json` and `coverage.json` and rewrites only the SVGs, sweeping any a cohort no longer carries. Use it after a chart change; use `report` after a run. The website build rasterizes each one to a 2x PNG under `public/benchmark/png/`.

Raw run records and measured workspaces stay under the ignored `benchmarks/evidence/output/`. Only the aggregate is tracked.

USD cost is reconstructed from each native request's token categories and context tier, and published only when those requests exactly match the retained total.

Pass repeated `--run-id <run-id>` arguments to both commands to publish an explicit historical cohort.

## Coverage

Coverage answers how much of the provenance graph a codebase satisfies, over the thirteen reference edges that run from a requirement anchor down to tests, properties, and journeys.

Only Plain is measured. The Evidence arm's plugin enforces every one of those edges as a build gate, so a cell that compiled has already satisfied the graph; its coverage is one by construction, and there is nothing there to analyze or count.

Count the edges while reviewing a completed Plain workspace read-only, and record each as an eligible population and a reached count rather than a ratio. The plugin cannot do this counting. A Plain codebase carries no `@evidence` tags, so every population it selects is empty, and an empty population demands nothing — running the rules against it reports full coverage while checking nothing.

Compose the counts rather than combining them by hand:

```bash
pnpm --filter @ttsc/benchmark-evidence coverage <measurement.json>
```

It writes `benchmarks/evidence/aggregate/coverage.json` and prints the comparison table. Run it with no arguments for the input shape.

The composition is not a formality. Averaging the thirteen rates ignores structure and lets a healthy near end average away a broken far end; multiplying them treats branches as a chain and collapses toward zero, because branch failures are correlated rather than independent. One subject scored 58.4% the first way and 0.003% the second. Serial hops multiply, branches average, and every edge enters exactly once — see issue #1088 for the derivation and for the two questions it leaves open, branch weighting and the independence the serial hops still assume.

## Close A Cohort

A cell is execution-complete only when all three hold:

1. `state.json` is `completed`.
2. Every instruction in its arm's sequence has a native terminal checkpoint.
3. The final process exits zero without a signal, or records a runner-owned forced shutdown after those checkpoints completed.

Engine completion is recorded execution behavior, never a quality verdict.

Review every completed workspace read-only. Accept `docs/analysis/**` as the specification without validating it, and report defects only in the generated application or in mismatches between its artifacts and the specification. Requirements are never defect candidates.

Report each run ID, retained status, instruction, session and CLI identity, token categories, cost, instruction and process time, exit code, signal, interruption, and remaining unknown. A measurement the runner did not retain is reported as unknown, never reconstructed.

Run directories are the record. Nothing in them is deleted at the end of a campaign.

## Close The Pull Request

1. Commit and push every correction, including the regenerated aggregate.
2. Perform the pull-request skill's complete Overall Self-Review. Never partition a round, and restart a complete round after any correction. Stop only when one round finds nothing to improve.
3. Inspect CI.
4. Merge when the cohort is closed and every required check is green.

A recurring template, instruction, or runner defect is corrected under [intervention/boundary.md](../intervention/boundary.md), not here.
