# Dashboard

The dashboard is the campaign's live record, and it lives in the draft pull-request body. It is generated, never written by hand: run the generator and paste what it printed.

Never reconstruct a value the generator did not produce, and never read workspace source to rebuild one.

## Refresh

Run both, then paste what the second printed:

```bash
pnpm --filter @ttsc/benchmark-evidence audit-suspensions
pnpm --filter @ttsc/benchmark-evidence dashboard
```

`audit-suspensions` compares each reported run against Windows Kernel-Power disconnected-standby events and records a verified idle interval in that run's `suspensions.json`. That file is the only one it may write; it must not modify `state.json` or a measured workspace.

It is Windows-only and says so by throwing: off `win32` it refuses rather than reporting zero intervals, because silently crediting a suspended run with its idle time as work would inflate the arm that happened to be running when the machine slept. On another platform the campaign runs, and its work time carries whatever suspensions the record could not subtract.

`dashboard` takes no arguments and always renders the latest launched run of each cell. It cannot be pointed at a historical cohort; `--run-id` belongs to `audit-suspensions` and `report`, and [aggregate.md](aggregate.md) owns that path. Passing it here is refused, so a run ID appended to all three commands fails loudly instead of publishing the live cohort under a historical label.

Refresh every 5 minutes, and immediately after a state change or an anomaly.

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
| `awaiting-review-verdict` | A cell stopped for a decision, or an inspection is running under it | With no live runner, resume to retry the inspection; with one, the status only changes after the verdict, so wait. [plain-review.md](plain-review.md) |
| `checkpointed` | Stopped deliberately after `backend-start` | Finished. Derive from it, never resume it |
| `quality-failed` | Supplementation attempts exhausted | Finished. It cannot resume |
| `interrupted` | Stopped abnormally | Diagnose, then resume — [intervention/recovery.md](../intervention/recovery.md) |
| `completed` | Every objective reached a terminal checkpoint | Close it — [aggregate.md](aggregate.md) |

## Reading The Columns

Two are commonly misread:

- **Progress** is the Git delta from the prepared baseline. It measures implementation volume, not a completion percentage.
- **Cost** is rounded to whole millions, so a cell under half a million tokens reads `0M` — a rounding artifact, not a missing measurement.

`Cost` and `Work time` both include what judging the cell's Reviews cost, attributed to the stage each inspection judged, and [plain-review.md](plain-review.md) owns why.

Work time excludes verified suspensions, setup time, and operator time.

The tracked artifacts a campaign publishes at the end are a different command and a different file set; [aggregate.md](aggregate.md) owns them.
