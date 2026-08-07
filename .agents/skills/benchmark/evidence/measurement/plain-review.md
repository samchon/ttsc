# Review Boundaries

A cell at `awaiting-review-verdict` is waiting for a decision, and three facts answer most of why:

- **The runner judges it itself.** A fresh inspecting thread decides, and the cell continues in the same command.
- **A resume retries a failed inspection.** Three attempts are permitted at one boundary.
- **Only after the third failure do you write a verdict by hand.**

## Where A Cell Stops

Every cell stops after its Backend, Frontend, and Overall Review, and again after each supplementation Goal. Both arms do, and that is the point: a cell nobody checks is a cell whose only gate is the compiler, and the compiler can enforce that a citation resolves rather than that it is true. Inspecting both arms makes the comparison "graph plus review" against "review", which is the variable the campaign exists to measure.

The retained status is `awaiting-review-verdict`, and the cell cannot continue until a verdict is applied.

## Who Judges

At the boundary the runner spawns a fresh Codex thread on the cell's own model and effort. It reads the attempt's stage log and the measured workspace, returns a decision, and the cell continues in the same command.

The inspection costs what a model run costs, and its tokens and time join the cell's `Cost` and `Work time`; [dashboard.md](dashboard.md) owns how that appears. Every attempt is retained under `inspection/<NN>-<stage>-<attempt>.*`, so a retry never overwrites the evidence of the attempt before it.

## Keep The Inspector Outside The Cell

The measured agent must not learn that it is being judged or by what criteria. A cell that knows the criteria can satisfy the criteria instead of meeting them, and every later attempt of every later cell would then measure something else.

- **A separate thread.** The inspection never runs inside the measured thread and never speaks to it.
- **Read-only.** It reads the attempt's stage log, which lives in the run root outside the workspace, and the workspace. It writes nothing into either.
- **No text reaches the cell.** A decision carries `decision` and `rationale` only, and the runner refuses one carrying a `feedback` property. Every failing scope receives the identical prescribed reminder, so attempt counts stay comparable between cells.

## What A Verdict Judges

The questions differ by arm, because the two arms are not doing the same work, and `EvidenceBenchmarkInspection.ts` owns their exact wording.

A Plain review is a reading loop, so what can be checked is whether the loop ran:

1. **Did the prescribed review loop run to dryness?** Pass an attempt that read its full scope every round and ended on a round that read everything and changed nothing, despite checklist or formatting slips. Fail one that substituted counts, summaries, searches, or green commands for reading; divided its scope across rounds; skipped the re-read after its last edit; or reported a dry round the stage log shows it never performed.
2. **Are the tests properly written?** Judge them against the workspace's own testing instructions. A suite that names one test for a hundred published operations, that asserts nothing, that asserts only that a call did not throw, or that pins the implementation's current output instead of the behavior it owes, is not properly written however green it runs.

An Evidence review inspects its own acknowledgements, and the compiler has already proved that every target resolves, so what is left is whether each citation is true. Six questions: whether every hook cites the operations it calls, whether every screen uses the hooks it cites and renders data serving the requirement it cites, whether every journey asserts an observable outcome for each requirement it cites, whether every exclusion is a reviewed non-applicability decision with a condition that would invalidate it, whether any citation names an ancestor whose subtree the host does not own, and the same test question.

A question an arm passes is still worth asking; it is what makes the ones it fails mean something.

Nothing else is a verdict's business. Design taste, formatting, checklist bookkeeping, and commit hygiene are observations for the rationale, never grounds.

Final is a finishing and safety stage after a passed Review, not permission to accept a false Review pass.

## What Each Decision Does

- **Pass** skips the reminder and advances directly to that scope's Final.
- **Fail** inserts that scope's `<arm>/<scope>/remind.md`, joined by the runner with that scope's own Review instruction quoted in full. The reminder carries nothing cell-specific — it asserts that the report was rejected, orders the full Review again unconditionally, and states the evidentiary standard the inspection applies. The cell then stops for another decision after the supplementation Goal.

Four supplementation attempts are permitted. A failure after the last one retains `quality-failed`, does not dispatch Final, and cannot be resumed. The attempt a scope stops on is itself a measurement, so the bound is set where a cell that can converge still has room to.

Four rather than eight because a cell that answers a reminder answers the first one. The `todo` Plain cell of the first `0.6.0` cohort spent all eight: its first supplementation ran 346 commands and changed 9 files, and the seven after it ran 8 commands between them and changed nothing, the last executing no command at all. Attempts past the point of movement measure nothing and are charged at full inspection price.

The runner retains each decision's exact bytes and digest alongside the workspace digest and Goal boundary, and refuses a decision whose earlier retained verdict files no longer match their digests.

## Reading How Far A Cell Has Got

`instructionPlan` grows mid-run, because a failing verdict splices one supplementation into it. A cell sitting at index N of an N+1-length plan is therefore not necessarily one instruction from the end: a scope can take four of them, and each undecided boundary is another one waiting to be added.

**Read the plan only after the verdict that may extend it has been written.** A plan read while a cell sits at `awaiting-review-verdict` describes the cell as further along than it is. That produced two wrong conclusions in the first `0.6.0` cohort, "the supplementation bound is spent" and "the cell is one instruction from completing", both from a pre-verdict snapshot.

**The reliable trigger is the appearance of a new verdict file under `supervision/`**, not a status change and not the plan's length.

## When The Inspection Cannot Decide

A spawn failure, a failed turn, an unreadable decision, an unaccountable token report, or the inspection timeout leaves the pause undecided. The reason lands on that attempt's `failure`, naming what did not match with the raw text excerpted.

**Resuming the run retries the inspection.** The common failures are transient and an operator adds nothing to them.

Three attempts are permitted at one boundary, because each is a full model run on the cell's own model and a permanently broken inspector must stop rather than spend the account one resume at a time.

After the third failure the run stays at `awaiting-review-verdict` and a resume refuses outright. Only an operator can move the boundary from there, so write the verdict by hand:

```json
{
  "decision": "fail",
  "rationale": "The retained review omitted material source paths and did not repeat its full inspection after editing them."
}
```

```bash
pnpm --filter @ttsc/benchmark-evidence supervise <subject> <run-id> <verdict.json>
```

Then resume the same run command.

A hand-written verdict answers the same two questions and obeys the same rules: no `feedback` property, and the reasoning stays in the retained `rationale`, which the cell never sees.

An operator warning is a different channel with its own command and contents, and [intervention/warning.md](../intervention/warning.md) owns it. Do not reach for a verdict to deliver one.

## Optional: The Backend Review Ledger

`--review-ledger` makes the backend review loop mechanically provable instead of self-reported. It is an addition to everything above, not a replacement for any of it.

It is Plain-only and needs a detached `backend-start` checkpoint thread, so it attaches to an existing run ID or a `--from-backend-start` derivation, never to a fresh cell:

```bash
pnpm --filter @ttsc/benchmark-evidence start codex <subject> plain <model> <effort> --review-ledger --from-backend-start <source-run-id>
```

During `backend-review` the runner holds the cell's sandbox read-only and injects six tools as the only mechanisms that receive review credit:

`review_start_round` · `review_read_file` · `review_finish_round` · `review_start_calibration` · `review_edit_file` · `review_run_backend_command`

`backend-review` and `backend-final` then refuse to complete unless a runner-owned round ended `dry` and the workspace manifest still hashes to what that round read. A shell inventory, a self-authored manifest, or a summary earns nothing.

**The verdict boundary still fires.** `backend-review` stops at `awaiting-review-verdict` exactly as it does without the flag, because the boundary is computed from the arm and the instruction alone. The inspecting thread also knows nothing about the ledger, so it still judges the loop from the stage log. Expect a ledger run to stop for a verdict, and do not read that stop as a stall.

The fresh thread restarts its token counter at zero, and the dashboard adds the inherited pre-thread goals back into the cell's total. Report what the generator printed and never hand-compute a ledger run's totals.
