# Recovery

Diagnose before acting, and preserve every run. Warn and resume when possible, derive only for an instruction defect after `backend-start`, and restart only when recovery is impossible.

| Observed | Do |
| --- | --- |
| A frozen file was edited | Confirm with [integrity.md](integrity.md), warn, resume. |
| A cell stopped, died, or failed to launch or resume | Diagnose, then resume the same run. |
| Process alive, log silent past the threshold | Stop the process, free the ports, resume. |
| No objective left | Nothing; never restart a finished cell. |
| `inspection/` holds only a prompt and schema | Nothing; the inspection is running. |
| Status `blocked` | Resume; it is a measured outcome. |
| Ports held but no runner of its own | Free the ports, resume. |
| `awaiting-review-verdict` | Resume ([review.md](review.md)). |
| Repository defect | Fix it where [boundary.md](boundary.md) allows. |
| Anything else | Note it in the pull request and change nothing. |

## Diagnose

- Find the failing instruction, process result, and session in `state.json`, `events.jsonl`, and the stage logs. `state.json` is the runner's last write, not current truth; trust log growth first.
- Copy `state.json` aside before resuming, since a resume overwrites it, and read the launcher's output after resuming, where a refused launch is reported.

## Resume

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> <model> <effort> <run-id>
```

Use the cell's own model and effort. The runner refuses a changed identity; a runner fix needs a clean commit descending from the cell's `benchmarkRevision`. `checkpointed` runs cannot resume. If a resume fails, diagnose that failure and recover from the last checkpoint.

## Derive

For an instruction defect after `backend-start`, keep the source run and derive a new one from its checkpoint; never edit the checkpoint, and report inherited and new measurements together:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> <evidence|plain> <model> <effort> --from-backend-start <source-run-id>
```

## Cancel

Stop the watchers, then every benchmark and native process, and confirm none remains. Keep every run directory and report each cell as incomplete.
