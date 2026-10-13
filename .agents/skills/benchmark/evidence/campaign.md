# Evidence Campaign

A campaign has one engine build the same application with `@ttsc/evidence` (the Evidence arm) and without it (the Plain arm); one subject and arm is a cell. [benchmarks/evidence/README.md](../../../../benchmarks/evidence/README.md) documents the runner, its commands, port blocks, checkpoints, and retained record.

## Open And Launch

1. Open the campaign issue, push an empty commit on the campaign branch, and open a draft pull request recording the authorized matrix, revisions, models, efforts, CLI versions, and Evidence archive digest.
2. Freeze every input of a cell before launch, and launch only authorized cells, with model `gpt-5.6-luna` and effort `high` unless the user names others; never compare a cell run otherwise with the default cohort.
3. Never run two commands on one run ID at once, and share one packed archive across parallel Evidence cells.

## Supervise

Every 30 seconds, check each cell's `events.jsonl` and `<stage>.log` growth, `state.json`, process liveness, and its frozen configuration files against [integrity.md](integrity.md).

- Only log growth proves work. A live process with no growth past the silence threshold is hung; set that threshold above the longest silence any finished objective showed, and record it.
- After any restart, confirm every watcher is alive by seeing the dashboard advance.
- Take anything else to [recovery.md](recovery.md).

## Dashboard

The dashboard is the draft pull-request body. Every 5 minutes and after any state change, run `audit-suspensions`, then `dashboard`, and paste its output unchanged. Never write or reconstruct a value by hand; anomalies go in prose outside it.

- `ready`: wait. `running`: watch. `awaiting-review-verdict`: resume ([review.md](review.md)). `checkpointed`: derive, never resume. `quality-failed`: resume. `interrupted`: diagnose and resume. `completed`: close ([aggregate.md](aggregate.md)).
- Progress is the Git delta, not a completion percentage. Cost rounds to millions, so under half a million reads `0M`. Work time includes Review inspection and process time between objectives.
