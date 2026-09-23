# Running A Campaign

One cell is one native session driven through its arm's objectives. The operator freezes the inputs, launches, and watches; the runner prepares the workspace, sends every objective, and retains the record. [benchmarks/evidence/README.md](../../../../../benchmarks/evidence/README.md) describes what the runner does: workspace preparation, the port block, run options, archive sharing, the instruction sequence, and the retained record. This document holds the operator's procedure.

## Contents

- [Open The Campaign](#open-the-campaign)
- [Launch A Cell](#launch-a-cell)
- [Supervise](#supervise)

## Open The Campaign

1. Open the campaign issue.
2. Use the campaign branch in the repository's single worktree.
3. Push an empty campaign commit and open a draft pull request.
4. Record the authorized matrix, benchmark revision, engines, models, efforts, CLI versions, Evidence archive digest, and live dashboard in the pull-request body.
5. Refresh that body every 5 minutes and immediately after a state change or anomaly, as [dashboard.md](dashboard.md) describes. [Watch the watcher](#watch-the-watcher) for the duty that outlives a restart.

## Launch A Cell

Freeze every input before launch, and never launch an unauthorized cell or rerun:

- **Identity:** subject, arm, engine, model, effort.
- **Material:** requirements, template, instructions, package archive.
- **Version:** CLI version, benchmark revision.

[intervention/boundary.md](../intervention/boundary.md) owns what may change and when.

Unless the user names something else, every campaign runs the same engine, model, and effort. Only the subject and arm vary:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> gpt-5.6-luna high
```

- **`codex`** is the only engine the command line accepts.
- **`gpt-5.6-luna`** is the default model. `report` also prices `gpt-5.6-terra` and `gpt-5.6-sol`, and an unpriced string still launches and is measured but publishes no USD cost.
- **`high`** is the default effort. The parser also accepts `low`, `medium`, `xhigh`, `max`, and `ultra`.

The model and effort are defaults, not a menu you pick from. Change either only when the user names it, and record what they authorized in the pull-request body. Cost is why the default is what it is, and a cell run at another model or effort is not comparable with a cohort that used these.

Never run two commands against the same run ID at once. A resume reuses the run ID by design, so the rule is about concurrency, not about a second invocation.

A launch that fails before native work does not consume the authorized cell, as long as its identity and frozen inputs are unchanged. Two such failures are ordinary: an unclean repository, and an occupied port from the cell's own block.

### Port Blocks

Every cell owns a disjoint block of four ports from base 46000, so two cells never contend:

| subject  | arm      | api   | swagger | vite  | playwright |
| -------- | -------- | ----- | ------- | ----- | ---------- |
| todo     | evidence | 46000 | 46001   | 46002 | 46003      |
| todo     | plain    | 46010 | 46011   | 46012 | 46013      |
| reddit   | evidence | 46020 | 46021   | 46022 | 46023      |
| reddit   | plain    | 46030 | 46031   | 46032 | 46033      |
| shopping | evidence | 46040 | 46041   | 46042 | 46043      |
| shopping | plain    | 46050 | 46051   | 46052 | 46053      |
| erp      | evidence | 46060 | 46061   | 46062 | 46063      |
| erp      | plain    | 46070 | 46071   | 46072 | 46073      |

What contends is never another cell; it is a cell and its own past. [intervention/recovery.md](../intervention/recovery.md) owns the orphan case.

### Backend-Start Checkpoints

`--stop-after-backend-start` seeds a reusable `backend-start` checkpoint for downstream instruction work without spending the rest of a cell. It cannot be combined with `--from-backend-start`, and the runner refuses the stop if the checkpoint is missing. [intervention/recovery.md](../intervention/recovery.md) owns the derivation.

### Parallel Evidence Cells

Pack one Evidence archive and export `EVIDENCE_BENCHMARK_ARCHIVE` before launching Evidence cells in parallel, as the README describes, so every cell measures one artifact.

### Review Boundaries

Only Plain stops at a Review boundary; Evidence runs its sequence without stopping. [plain-review.md](plain-review.md) owns that loop.

## Supervise

Observe every active cell at least every 30 seconds:

- The growth of `events.jsonl` and of the current stage's `<stage>.log`.
- `state.json`, and benchmark and native process liveness.
- The frozen configuration files in every cell. Re-read them on every cycle and report a hit as a material change, quoting the diff you just read. [integrity.md](integrity.md) owns what is a hit and what is the cell doing its job.

Correct the dashboard on any disagreement immediately, without waiting for its 5-minute interval.

### Liveness Is Growth, Not Presence

A cell is advancing when its stage log or `events.jsonl` has grown since the last observation. Nothing else proves work.

A live process proves only that something is attached to the thread. A turn can hang while its process stays resident and its status stays `running`, and that shape produces no diagnostic, no exit, and no status change. Presence is therefore never sufficient, and a supervisor that accepts it reports a stopped cell as healthy for as long as the process survives.

Absence of growth is not sufficient either. One objective can run past an hour without emitting a line, so a supervisor that treats every silence as death restarts working cells.

Both signals are needed, and they are not symmetric:

| Growth | Process | Reading |
| --- | --- | --- |
| yes | yes | advancing |
| yes | no | the turn ended; expect the next to start or the run to settle |
| no | yes | **hung**, once silence exceeds the threshold |
| no | no | stopped |

Set the silence threshold above the longest silence any completed objective in the cohort has shown, and record the figure in the pull-request body with the objective it came from. A threshold chosen without that measurement is a guess in whichever direction it is wrong.

### Watch The Watcher

Supervision that a restart can end silently is not supervision. Verify on every session start, and after any machine restart, that every liveness watcher is alive, and restart any that is not.

A watcher stopping is invisible from its own output, because a healthy watcher and a dead one both say nothing. Confirm liveness by observing that the dashboard advanced, never by observing that no alarm arrived.

Take anything else to [intervention/SKILL.md](../intervention/SKILL.md), and diagnose before touching it.
