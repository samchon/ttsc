# Warning

A warning is the operator's one channel into a cell. It carries only what no agent can derive from inside its workspace: an authorization, or a frozen boundary it has crossed. It never carries a finding, and it says nothing about the subject.

**Warn and resume; do not restart.** The violation is measured behavior and the run holds the evidence of it. A restart destroys that record, discards the cell's work, and answers a correctable mistake with the most expensive remedy available. Restart only when the cell cannot be recovered at all, and say in the report what made recovery impossible.

Stop the cell, attach the warning to its current objective, then resume the same run command:

```bash
pnpm --filter @ttsc/benchmark-evidence warn <subject> <evidence|plain> <run-id> <warning.json>
```

The warning file is a failing decision with a retained `rationale` and the `feedback` the cell will read:

```json
{
  "decision": "fail",
  "rationale": "The cell narrowed the reference files glob in packages/backend/test/lint.config.ts.",
  "feedback": "Restore packages/backend/test/lint.config.ts to its committed baseline. Its lint configuration is not yours to change."
}
```

The runner refuses feedback that names the machinery outside the workspace, because a cell told it is being measured stops being a measurement. `EvidenceBenchmarkSupervision.ts:459` owns the exact pattern, and it rejects three families of wording:

- The benchmark, an operator, an auditor, a verdict, supervision or a supervisor, a reviewer, or the plugin.
- Another, other, external, main, or measurement **agent**.
- The Plain or Evidence **arm**, **mode**, or **agent**.

Write the correction as an instruction about the workspace, naming the file and the state to restore, and none of these appear.

A review verdict is a different channel with its own command and contents, and [plain-review.md](../measurement/plain-review.md) owns it. Do not reach for a warning to deliver one.
