# Aggregate

`benchmarks/evidence/aggregate` is what a campaign publishes. Run `audit-suspensions`, then `report`, and commit what it wrote; never commit charts. Before publishing a figure, derive it a second way, such as stage sums against the cell total, and publish neither if they disagree.

## Coverage

Only Plain is measured, over the thirteen reference edges from requirement anchors to tests, properties, and journeys; the Evidence arm satisfies them by construction. Count each edge's eligible and reached population while reviewing the finished workspace read-only, then run `pnpm --filter @ttsc/benchmark-evidence coverage <measurement.json>`. Report its assumptions: branch weighting and independence of serial hops.

## Close

- A cell is complete when `state.json` is `completed`, every instruction has a terminal checkpoint, and the last process exited zero or by a runner-owned shutdown.
- Review each finished workspace read-only against `docs/analysis/**` as the specification; requirements are never defects.
- Report each run's identity, status, tokens, cost, times, exit, and unknowns. Never reconstruct an unretained number, and never delete a run directory.
- Commit the regenerated aggregate, run [Overall Self-Review](../../review/SKILL.md), and merge once the cohort is closed and checks are green.
