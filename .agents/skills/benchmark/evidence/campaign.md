# Evidence Campaign

A campaign has one engine build the same application with `@ttsc/evidence` (Evidence arm) and without it (Plain arm). One subject and arm is a cell; one execution is a run under `benchmarks/evidence/output/<subject>/codex/<arm>/runs/<run-id>/`. [benchmarks/evidence/README.md](../../../../benchmarks/evidence/README.md) documents the runner and its commands.

## Open And Launch

1. Open the campaign issue, push an empty commit on the campaign branch, and open a draft pull request recording the authorized matrix, revisions, models, efforts, CLI versions, and Evidence archive digest.
2. Freeze every input of a cell before launch, and launch only authorized cells:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> gpt-5.6-luna high
```

- `gpt-5.6-luna` and `high` are the defaults; change them only when the user names others, and never compare such a cell with the default cohort.
- Never run two commands on one run ID at once.
- Before parallel Evidence cells, pack one archive and export `EVIDENCE_BENCHMARK_ARCHIVE`.
- Each cell owns four ports (api, swagger, vite, playwright) from its base: todo 46000/46010, reddit 46020/46030, shopping 46040/46050, erp 46060/46070 for Evidence/Plain.

## Supervise

Every 30 seconds, check each cell's `events.jsonl` and `<stage>.log` growth, `state.json`, process liveness, and its frozen configuration files against [integrity.md](integrity.md).

- Only log growth proves work. A live process with no growth past the silence threshold is hung; set that threshold above the longest silence any finished objective showed and record it.
- After any restart, confirm every watcher is alive by seeing the dashboard advance.
- Take anything else to [recovery.md](recovery.md).

## Dashboard

The dashboard is the draft pull-request body. Every 5 minutes and after any state change, run `audit-suspensions`, then `dashboard`, and paste its output unchanged. Never write or reconstruct a value by hand; anomalies go in prose outside it.

- `ready`: wait. `running`: watch. `awaiting-review-verdict`: resume ([review.md](review.md)). `checkpointed`: derive, never resume. `quality-failed`: resume. `interrupted`: diagnose and resume. `completed`: close ([aggregate.md](aggregate.md)).
- Progress is the Git delta, not a completion percentage. Cost rounds to millions, so under half a million reads `0M`. Work time includes Review inspection and process time between objectives.
