# Dashboard

The dashboard is the campaign's live record, and it lives in the draft pull-request body. It is generated, never written by hand: run the generator and paste what it printed.

Never reconstruct a value the generator did not produce, and never read workspace source to rebuild one.

## Refresh

Run `audit-suspensions`, then `dashboard`, and paste what the second printed; [benchmarks/evidence/README.md](../../../../../benchmarks/evidence/README.md) describes both commands. Refresh every 5 minutes, and immediately after a state change or an anomaly.

`dashboard` refuses every argument, `--run-id` included, because it can only render the latest launched run of each cell. A historical cohort goes through `report`, which [aggregate.md](aggregate.md) owns.

## Shape

Group by authorized model with one H2 per model. Under each model, render one summary table followed by each cell's retained stage list.

Only the latest launched run of a cell appears, and a cell that has not launched appears nowhere.

```markdown
## GPT-5.6-Luna

| Cell | Stage | Progress | Cost | Work time |
| --- | --- | --- | ---: | ---: |
| Todo Plain | `backend-review` · running | 27 files · +3.1k/−20 LOC | 7M | 1h 07m |

- **Todo Plain stages**
  - `backend-start`: 3M · 42m · 43% tokens · 63% time
  - `backend-review`: 4M · 25m · 57% tokens · 37% time
  - review `backend` attempt 0: fail -> retry (a1b2c3d4e5f6)
```

Those five columns, in that order, are the whole table. Do not add a run ID, a token-category breakdown, a wall-clock elapsed time, a quality judgment, or any further column.

Anomaly detail belongs in the pull-request prose outside the dashboard.

## Statuses

The Stage column appends the retained status after `·`, and a cell that has retained no goal yet shows the bare status alone. There are seven, and each says what you do next:

| Status | What it means | What you do |
| --- | --- | --- |
| `ready` | Prepared, no objective dispatched | Wait |
| `running` | An objective is active | Watch |
| `awaiting-review-verdict` | A Plain cell stopped for a decision | Resume to retry the inspection. See [plain-review.md](plain-review.md) |
| `checkpointed` | Stopped deliberately after `backend-start` | Finished. Derive from it, never resume it |
| `quality-failed` | Retained by the earlier behaviour, where exhausting a scope ended the cell | Resume. It continues from the boundary its plan already points past. See [plain-review.md](plain-review.md) |
| `interrupted` | Stopped abnormally | Diagnose, then resume. See [intervention/recovery.md](../intervention/recovery.md) |
| `completed` | Every objective reached a terminal checkpoint | Close it. See [aggregate.md](aggregate.md) |

## Reading The Columns

Two are commonly misread:

- **Progress** is the Git delta from the prepared baseline. It measures implementation volume, not a completion percentage.
- **Cost** is rounded to whole millions, so a cell under half a million tokens reads `0M`, a rounding artifact, not a missing measurement.

`Cost` and `Work time` both include what judging the cell's Reviews cost, attributed to the stage each inspection judged, and [plain-review.md](plain-review.md) owns why.

Work time excludes verified suspensions, setup time, and operator time.

It is the model process's uptime plus what judging the Reviews cost, not the time the cell spent inside its objectives. The two differ: across round two's cells the goals' own elapsed sum is 88% to 99% of the published figure, the rest being the process alive between them. Read the column as what the cohort spent, not as what the agent worked, and take the per-stage list under it as the second reading: stage tokens close against the cell total, while stage time falls short of it by exactly that difference.

The tracked artifacts a campaign publishes at the end are a different command and a different file set; [aggregate.md](aggregate.md) owns them.
