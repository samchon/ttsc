# Recovery

Diagnose before acting, and preserve every run. Warn and resume when possible, derive a run from the `backend-start` checkpoint only for an instruction defect after it, and restart only when recovery is impossible. [benchmarks/evidence/README.md](../../../../benchmarks/evidence/README.md) gives the resume and derive commands.

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

- Find the failing instruction, process result, and session in `state.json`, `events.jsonl`, and the stage logs. `state.json` is the runner's last write, not current truth; trust log growth first.
- Copy `state.json` aside before resuming, since a resume overwrites it, and read the launcher's output afterwards, where a refused launch is reported.
- Resume with the cell's own model and effort. A runner fix needs a clean commit descending from the cell's `benchmarkRevision`. If a resume fails, diagnose that failure and recover from the last checkpoint.
- Never edit a checkpoint or its source run, and report a derived run's inherited and new measurements together.
- To cancel, stop the watchers, then every benchmark and native process, and confirm none remains. Keep every run directory and report each cell as incomplete.
