# Recovery

## Diagnose

Preserve the run and identify the exact instruction, process result, native session, and failure from `state.json`, `events.jsonl`, and the stage logs. The failing instruction names the file to read.

Always read the launcher's own output after a resume. A refused launch says so there and nowhere else, which is how a cell that is merely unable to start comes to look dead.

**Read `state.json` before acting on any failure notice.** A notice describes the moment a benchmark process exited, not the moment you read it, and what happens in between is a recovery: diagnosing, freeing the cell's ports, and resuming take minutes even at a 30-second observation cadence. So a cell that declared its own goal blocked, exited non-zero, and was resumed is running again on a new runner by the time its original failure surfaces, and acting on the notice alone means touching a cell that was already recovered, which happened three times in the first cohort. The retained state is what separates that cell from one still down.

Two states read as a stall and are usually not one:

- **A goal update with status `blocked`.** That is the agent declaring its own goal blocked, which is a measurement outcome rather than a fault. Resume it.
- **An `inspection/` directory holding only a prompt and a schema.** That is what an inspection looks like from the moment it is prepared until its decision is written, so it usually means one is in flight and the decision arrives in the same command. A crashed inspector leaves the same two files, so confirm the runner is alive before waiting on it; with no live runner this is a stopped cell to resume, and [plain-review.md](../measurement/plain-review.md) owns the retry.

When the resume conditions below match, resume immediately after diagnosis and any required runner correction. Do not wait for operator prose or the next reporting interval.

## Free The Cell's Ports

A cell never contends with another cell — the blocks are disjoint, and [measurement/running.md](../measurement/running.md) maps them. A cell contends with its own past: a killed runner leaves its API server, Swagger, Vite, and Playwright children holding that block, and the next launch fails its pre-launch port check.

Before resuming a stopped cell, confirm its four ports have no listener and stop whatever holds one. A listener on a cell's port while no runner of its own is alive means orphans are blocking recovery, and the reporting subagent reports that as its own condition rather than as a dead cell.

## Resume The Same Run

**Snapshot `state.json` before resuming.** Resuming overwrites the interruption record, and twice the cause of a stop was lost that way. Copy it outside the run directory first; the run directory itself is the record and nothing in it is edited.

Resume only when the cell identity, frozen inputs, workspace, CLI version, objective, and native checkpoint still match:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> <model> <effort> <run-id>
```

Repeat that cell's own model and effort rather than the campaign default. The runner compares engine, subject, arm, model, effort, run ID, stop point, and ledger mode against the retained cell and refuses the resume on any difference.

Keep the cell's original `benchmarkRevision` frozen. When recovery requires a committed runner correction, resume only from a clean descendant revision, which the runner retains as the new process's `runnerRevision`.

Before continuing, the runner revalidates the stored cell, instruction bytes, workspace, artifact digest, CLI, session, Goal, and token boundary. Codex may resume an exact retained Goal checkpoint.

Two retained statuses refuse resume outright:

- `quality-failed` — the run exhausted its supplementation attempts and is finished.
- `checkpointed` — the run was stopped deliberately after `backend-start` and continues only as a derived run.

If the resume itself fails, preserve that attempt, diagnose the new failure, and recover again from the last exact checkpoint. Never abandon a cell, and never loop without evidence.

## Derive A Run From The Backend-Start Checkpoint

After `backend-start` completes, the runner stores a durable checkpoint of the material workspace, prepared Git baseline, native session and terminal turn, CLI version, token boundary, input digests, and inherited timing. It is a recovery point for a later downstream-instruction correction, not permission to modify an active measured workspace.

When a defect is confined to an instruction after `backend-start`, preserve the source run and create a new checkpoint-derived run:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> <model> <effort> --from-backend-start <source-run-id>
```

The command then:

1. Verifies the retained cell and the exact completed `backend-start` boundary.
2. Restores that workspace, reinstalls its dependencies, and revalidates the restored digests.
3. Reapplies the current non-product instruction surface — `AGENTS.md` and `.agents/`.
4. Forks the native thread through the retained terminal turn.
5. Starts the new run at `backend-review` with the current downstream instructions.

An explicit operator launch does not reject the checkpoint because repository inputs changed after it was created.

Never edit a checkpoint, its source run, or its retained state.

A derived run has a new run ID and records its source lineage and inherited timing. Report inherited and continuation measurements together, and never describe it as resuming the original run.

## Cancel The Campaign

Stop the reporting subagent and every liveness watcher first, then force-stop every benchmark command, native process, and owned descendant. Verify that no process still references an affected run.

Preserve every run directory and report each cell as incomplete. Never delete one and never mark it complete.
