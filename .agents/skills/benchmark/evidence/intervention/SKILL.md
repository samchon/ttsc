# Intervention

This is your view as this repository's agent: what you may change, how you warn a cell, and how you recover one. Whether a cell's own edit still counts is a measurement question, and [measurement/integrity.md](../measurement/integrity.md) owns it.

Diagnose before acting. Never blind-retry, never edit retained state, and never substitute a session.

Every remedy lands outside the measured workspace or in this repository.

## Triage

| What you observed | Remedy |
| --- | --- |
| A cell edited a frozen configuration file | Confirm it against [measurement/integrity.md](../measurement/integrity.md) first, then [warn it](warning.md) and resume. A prescribed `disabled` deletion or a new dependency is not a violation |
| A cell stopped, a process died, or a launch or resume failed | [Diagnose](recovery.md#diagnose), then resume the same run |
| A cell's process is alive while its stage log has stopped growing | [End the hung turn](recovery.md#recover-a-hung-turn), free its ports, then resume |
| A silent cell has no objective left | Nothing. [Never restart a finished sequence](recovery.md#never-restart-a-finished-sequence) |
| An `inspection/` directory holds only a prompt and a schema | Nothing. An inspection is in flight and writes its result when it returns |
| A goal update reports status `blocked` | Resume. A cell reporting that it is blocked is a measurement outcome, not a fault |
| A cell's ports have a listener but no live runner of its own | [Free the ports](recovery.md#free-the-cells-ports), then resume |
| A Plain cell sits at `awaiting-review-verdict` | Resume to retry the inspection. [plain-review.md](../measurement/plain-review.md) owns the loop |
| The dashboard disagrees with `state.json` | Regenerate it. [dashboard.md](../measurement/dashboard.md) owns the commands |
| A template, instruction, or runner defect | Fix it where [boundary.md](boundary.md) permits |
| Anything else | Record it in the pull-request prose and change nothing |

## Topics

- **[Boundary](boundary.md):** what you may never change, when to stop and ask the user, and where a benchmark defect may be corrected.
- **[Warning](warning.md):** the operator's one channel into a running cell.
- **[Recovery](recovery.md):** diagnosis, cell ports, resume, checkpoint-derived runs, and cancellation.
