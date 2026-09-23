# Plain Review

[benchmarks/evidence/README.md](../../../../../benchmarks/evidence/README.md) describes the mechanics of a Plain review boundary: where a Plain cell stops, the inspecting thread that judges it, the three inspection attempts, the hand-written verdict command, the identical reminder, the four supplementation attempts, and the review ledger. This document holds what an operator needs beyond them.

## Keep The Inspector Outside The Cell

The measured agent must not learn that it is being judged or by what criteria. A cell that knows the criteria can satisfy the criteria instead of meeting them, and every later attempt of every later cell would then measure something else. So the inspection runs in a separate thread that never speaks to the measured one, reads the stage log and the workspace without writing to either, and returns a decision whose `rationale` the cell never sees.

## What A Verdict Judges

Two questions, whose exact wording the inspection prompt in `EvidenceBenchmarkInspection.ts` owns:

1. **Did the prescribed review loop run to dryness?** Pass an attempt that read its full scope every round and ended on a round that read everything and changed nothing, despite checklist or formatting slips. Fail one that substituted counts, summaries, searches, or green commands for reading; divided its scope across rounds; skipped the re-read after its last edit; or reported a dry round the stage log shows it never performed.
2. **Are the tests properly written?** Judge them against the workspace's own testing instructions. A suite that names one test for a hundred published operations, that asserts nothing, that asserts only that a call did not throw, or that pins the implementation's current output instead of the behavior it owes, is not properly written however green it runs.

Nothing else is a verdict's business. Design taste, formatting, checklist bookkeeping, and commit hygiene are observations for the rationale, never grounds. Final is a finishing and safety stage after a passed Review, not permission to accept a false Review pass.

The bound is four supplementation attempts because a cell that answers a reminder answers the first one; attempts past the point of movement measure nothing and are charged at full inspection price. A scope can reach Final having failed every attempt, and the cohort report has to say so.

## Read The Loop By Its Verdict Files

A new file under `supervision/` is the only reliable sign that a decision landed. Count them to know how many attempts a scope has spent, and read the newest to know what the last one decided. The runner refuses a decision whose earlier retained verdict files no longer match their digests, so never edit one.

Neither the status nor the plan answers this. `instructionPlan` grows when a failing verdict inserts a supplementation, so its length is a consequence of a decision rather than a record of one, and reading it between a stop and the verdict that follows describes a plan that is about to change. Read the plan only after a transition completes, and never to infer how much of the bound is left.

## When The Inspection Cannot Decide

A spawn failure, a failed turn, an unreadable decision, an unaccountable token report, or the inspection timeout leaves the pause undecided, and the reason lands on that attempt's `failure` with the raw text excerpted. Resume the run to retry; the common failures are transient and an operator adds nothing to them.

After the third failure a resume refuses outright, and only a hand-written verdict moves the boundary. It answers the same two questions, carries only `decision` and `rationale`, and is followed by resuming the same run command:

```json
{
  "decision": "fail",
  "rationale": "The retained review omitted material source paths and did not repeat its full inspection after editing them."
}
```

An operator warning is a different channel with its own contents, and [intervention/warning.md](../intervention/warning.md) owns it. Do not reach for a verdict to deliver one.

## The Backend Review Ledger

`--review-ledger` injects six tools as the only mechanisms that receive review credit: `review_start_round`, `review_read_file`, `review_finish_round`, `review_start_calibration`, `review_edit_file`, and `review_run_backend_command`. A shell inventory, a self-authored manifest, or a summary earns nothing.

Expect a ledger run to stop for a verdict anyway, because the boundary is computed from the arm and the instruction alone and the inspecting thread knows nothing about the ledger; do not read that stop as a stall. The fresh thread restarts its token counter at zero and the dashboard adds the inherited pre-thread goals back into the cell's total, so report what the generator printed and never hand-compute a ledger run's totals.
