# Intervention

This is your view as this repository's agent: what you may change, how you warn a cell, and how you recover one. Whether a cell's own edit still counts is a measurement question, and [measurement/integrity.md](../measurement/integrity.md) owns it.

Diagnose before acting. Never blind-retry, never edit retained state, and never substitute a session.

Every remedy lands outside the measured workspace or in this repository.

## Triage

| What you observed | Remedy |
| --- | --- |
| A cell edited a frozen configuration file | Confirm it against [measurement/integrity.md](../measurement/integrity.md) first, then [warn it](warning.md) and resume. A prescribed `disabled` deletion or a new dependency is not a violation |
| A cell stopped, a process died, or a launch or resume failed | [Diagnose](recovery.md), then resume the same run |
| A cell's ports have a listener but no live runner of its own | [Free the ports](recovery.md), then resume |
| A Plain cell sits at `awaiting-review-verdict` | Resume to retry the inspection. [plain-review.md](../measurement/plain-review.md) owns the loop |
| A cell's goal update carries status `blocked` | The agent declared its own goal blocked. That is a measurement outcome; [resume it](recovery.md) |
| An `inspection/` directory holds only a prompt and a schema | An inspection in flight while its runner is alive, a stopped cell otherwise. [Confirm liveness first](recovery.md) |
| A failure notice names a cell | Read `state.json` first. The notice lags its event, and [the cell is often already running again](recovery.md) |
| The dashboard disagrees with `state.json` | Regenerate it. [dashboard.md](../measurement/dashboard.md) owns the commands |
| A template, instruction, or runner defect | Fix it where [boundary.md](boundary.md) permits |
| Anything else | Record it in the pull-request prose and change nothing |

## Topics

- **[Boundary](boundary.md)** — what you may never change, when to stop and ask the user, and where a benchmark defect may be corrected.
- **[Warning](warning.md)** — the operator's one channel into a running cell.
- **[Recovery](recovery.md)** — diagnosis, cell ports, resume, checkpoint-derived runs, and cancellation.
