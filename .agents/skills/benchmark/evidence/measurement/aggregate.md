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

### One Cohort Per Directory

`report` replaces `summary.json` and rebuilds `cells/` from nothing. It has never written `coverage.json`, which is counted by hand from a completed workspace, so a second cohort published over a first would leave the first's coverage beside the second's spend, and the renderer keeps every row whose model and subject appear in the report, which for a repeated subject is all of them.

Two things tie a coverage file to a cohort, and `report` checks both. `source.origin` names the repository it was counted in, and the tracked file carries `samchon/lint-plugin-evidence`, written by hand when the cohort was vendored in. That tie is the one a file with no rows at all still has, and it is skipped when the aggregate being written records no origin of its own. Each row's `runId` is the other, and it is what distinguishes two cohorts inside one repository.

`report` refuses to publish over a coverage file counted in another repository, over a row naming a run this cohort is not publishing, or over a row naming none. Recount it against this cohort's runs, or delete it and publish without the block. A cohort with no coverage at all still publishes; that state is ordinary and stays ordinary.

### Whose Cohort It Is

`summary.json` carries an `origin`, the repository whose run records the collection read, taken from that repository's own manifest and written as `owner/name` so it reads the way `coverage.json` already states the same fact. A manifest whose declared URL does not reduce to that shape records nothing rather than an unresolvable string, so an absent origin means the manifest did not name a repository usefully. Every cell carries the `benchmarkRevision` its launcher read from `HEAD`, and a bare SHA resolves nowhere on its own, so without the origin an aggregate vendored from another project is indistinguishable from one measured here, and the figures drawn from it read as this repository's own.

An aggregate published before the field existed does not have one, and it is not back-filled: writing a value into a generated artifact that nothing derived is the failure the field exists to prevent. Whatever publishes such an aggregate states its origin in prose instead.

Redraw the charts without collecting anything:

```bash
pnpm --filter @ttsc/benchmark-evidence charts
```

That reads `summary.json` and `coverage.json` and rewrites only the SVGs, sweeping any a cohort no longer carries. Use it after a chart change; use `report` after a run. The website build rasterizes each one to a 2x PNG under `public/benchmark/png/`.

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

**Cross-check every published number against one computed another way.** A figure the generator produced is still a figure one derivation produced, and a second derivation is how a wrong one is caught before it is published. Wall-clock derived from log mtimes once came out shorter than the work time it contained, which no single reading would have revealed. When the two disagree, publish neither until the disagreement is explained.

Run directories are the record. Nothing in them is deleted at the end of a campaign.

## Close The Pull Request

1. Commit and push every correction, including the regenerated aggregate.
2. Perform the pull-request skill's complete Overall Self-Review. Never partition a round, and restart a complete round after any correction. Stop only when one round finds nothing to improve.
3. Inspect CI.
4. Merge when the cohort is closed and every required check is green.

A recurring template, instruction, or runner defect is corrected under [intervention/boundary.md](../intervention/boundary.md), not here.
