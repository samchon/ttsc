# Aggregate

`benchmarks/evidence/aggregate` is what a campaign publishes and keeps. Like the dashboard it is generated from the retained record, so run the command and commit what it wrote.

## Publish

```bash
pnpm --filter @ttsc/benchmark-evidence audit-suspensions
pnpm --filter @ttsc/benchmark-evidence report
```

`report` writes four artifacts:

- `benchmarks/evidence/aggregate/summary.json`.
- Stable per-cell JSON under `benchmarks/evidence/aggregate/cells/<model>/<subject>/<arm>.json`.
- `summary.svg`, every subject on one token axis under the coverage block.
- One `arms.svg` beside each subject's cell JSON, carrying that subject's tokens, work time, and API cost.

It refuses to write when the collection is empty, because a checkout with no run tree would otherwise replace the tracked measurement with nothing.

Redraw the charts without collecting anything:

```bash
pnpm --filter @ttsc/benchmark-evidence charts
```

That reads `summary.json` and `coverage.json` and rewrites only the SVGs, so a clone reproduces every published chart. Use it after a chart change; use `report` after a run.

Raw run records and measured workspaces stay under the ignored `benchmarks/evidence/output/`. Only the aggregate is tracked.

USD cost is reconstructed from each native request's token categories and context tier, and published only when those requests exactly match the retained total.

Pass repeated `--run-id <run-id>` arguments to both commands to publish an explicit historical cohort.

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
