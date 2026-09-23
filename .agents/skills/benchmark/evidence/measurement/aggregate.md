# Aggregate

`benchmarks/evidence/aggregate` is what a campaign publishes and keeps. Like the dashboard it is generated from the retained record, so run the command and commit what it wrote.

## Publish

Run `audit-suspensions`, then `report`, as the "Publishable reports" section of [benchmarks/evidence/README.md](../../../../../benchmarks/evidence/README.md) describes, and commit the aggregate it wrote; a chart never needs committing. Use `charts` after a chart change and `report` after a run.

A stage log that two drivers wrote carries one writer's replayed counters beside the other's, and those lines are dropped rather than failing the run: the amount still has to reconcile to the retained total exactly, so it stays whole, while `replayedUpdates` records how many lines went and marks the request counts a lower bound.

## Coverage

Coverage answers how much of the provenance graph a codebase satisfies, over the thirteen reference edges that run from a requirement anchor down to tests, properties, and journeys.

Only Plain is measured. The Evidence arm's plugin enforces every one of those edges as a build gate, so a cell that compiled has already satisfied the graph; its coverage is one by construction, and there is nothing there to analyze or count.

Count the edges while reviewing a completed Plain workspace read-only, and record each as an eligible population and a reached count rather than a ratio. The plugin cannot do this counting. A Plain codebase carries no `@evidence` tags, so every population it selects is empty, and an empty population demands nothing; running the rules against it reports full coverage while checking nothing.

Compose the counts rather than combining them by hand:

```bash
pnpm --filter @ttsc/benchmark-evidence coverage <measurement.json>
```

It writes `benchmarks/evidence/aggregate/coverage.json` and prints the comparison table. Run it with no arguments for the input shape.

The composition is not a formality. Averaging the thirteen rates ignores structure and lets a healthy near end average away a broken far end; multiplying them treats branches as a chain and collapses toward zero, because branch failures are correlated rather than independent. One subject scored 58.4% the first way and 0.003% the second. Serial hops multiply, branches average, and every edge enters exactly once (see issue #1088 for the derivation and for the two questions it leaves open, branch weighting and the independence the serial hops still assume).

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
2. Perform a complete [Overall Self-Review](../../../review/SKILL.md#overall-self-review).
3. Inspect CI.
4. Merge when the cohort is closed and every required check is green.

A recurring template, instruction, or runner defect is corrected under [intervention/boundary.md](../intervention/boundary.md), not here.
