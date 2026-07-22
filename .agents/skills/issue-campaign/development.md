# Solo Campaign Development

Read this document in full when the user authorizes implementation pull requests or the end of a solo issue campaign that entered implementation. Also read the repository development, pull-request, and review skills before acting.

## Flow

- [Plan One Cycle Pull Request](#plan-one-cycle-pull-request)
- [Claim The Complete Cycle](#claim-the-complete-cycle)
- [Implement And Write Tests](#implement-and-write-tests)
- [Validate With CI And Overall Self-Review](#validate-with-ci-and-overall-self-review)
- [Merge And Clean Up](#merge-and-clean-up)
- [Repeat Until A Clean Round](#repeat-until-a-clean-round)

Five rules govern the implementation phase:

- Enter implementation only after the parent skill's discovery saturation ends with a complete fresh empty round against the recorded pre-development integrated state.
- The main agent performs all implementation, test authoring, CI diagnosis, adjudication, Overall Self-Review, and cleanup. For every coherent pushed issue-implementation commit, spawn exactly one read-only [Individual Self-Review](#implement-and-write-tests) subagent.
- Put every accepted, implementation-ready issue in the current cycle into one pull request. The issue DAG controls implementation order inside that pull request, not pull-request count.
- Work in the current checkout and one topic branch. Do not create a clone or worktree for a solo campaign or its Self-Review.
- The pull request's ordinary CI and a clean Overall Self-Review are the acceptance gates. Repair every red CI lane in that same pull request, even when the failure predates the campaign or is unrelated to its original issues.

## Plan One Cycle Pull Request

Confirm the discovery gate before planning or claiming work. The campaign ledger must identify the integrated baseline, every complete discovery round against it, the last round's empty result, and the accepted issue set accumulated across preceding nonempty rounds. Fetch the target branch and compare it with that baseline. If the last complete round is not empty or the target advanced, synchronize the target checkout, record the new baseline, and return to discovery instead of opening development.

Recompute the published-issue dependency DAG after publication. Record dependencies because they determine safe edit order and when one fix can expose another, but do not partition ready issues into separate pull requests.

Build the cycle scope in this order:

1. Reopen every published, unclaimed issue and verify it still belongs to this repository and campaign.
2. Remove only issues proved duplicate, invalid, out of scope, or externally blocked, and record the exact disposition. An accepted unresolved issue prevents campaign completion.
3. Check open pull requests and remote branches for overlapping work before claiming.
4. Put every remaining issue into one cycle ledger with its acceptance matrix, consequence surface, affected files, and DAG predecessors.
5. Record the issue count before grouping and the result as one pull-request unit.

Different packages, invariants, or validation lanes do not split the solo cycle. Keep issue-level commits when that improves diagnosis, but the pull request remains the integrated campaign unit.

An issue whose only predecessor is another issue in the same cycle is implementation-ready for this purpose. Order the edits through the DAG instead of deferring it to another pull request.

Difficulty never removes an issue from the cycle. When a resolution needs a judgment call about design, invariant ownership, or an acceptable behavior change, settle it from the issue's evidence and implement that decision inside the cycle. A proved duplicate, an invalid premise, an out-of-scope finding, and an external blocker remain the only dispositions that remove one.

## Claim The Complete Cycle

Claim the whole cycle before implementation:

1. Use the current checkout, confirm the target branch still matches the gated baseline, and create one topic branch from that exact state. Do not create a clone or worktree.
2. Create one implementation-free commit with `git commit --allow-empty`.
3. Push the branch and open one draft pull request.
4. Reference every cycle issue by number, mark verification pending, and state that the pull request owns the complete accepted cycle.
5. Record the checkout, branch, pull request, head SHA, issue set, and external temporary-asset ledger in `.wiki`.

Keep every closing keyword out of the claim body. The body is written before any code exists, so a claim-time closing list closes whatever the cycle later drops, defers, or disproves, burying the analysis those issues carry. The cycle's closing set is the union of the [commit closing lines](#implement-and-write-tests), which makes the merge close exactly what landed.

The empty pull request prevents overlapping contributor work before code is written. Measure official duration from its GitHub `createdAt` timestamp through `mergedAt`, including implementation, CI, review, fixes, rebases, and merge.

## Implement And Write Tests

Work through the DAG on the claimed topic branch. Analyze the full consequence and case surface across every issue before editing, then implement the complete cycle and its tests.

Implement without interruption. Write each piece's tests as that piece lands instead of leaving the tests for the end of the cycle, and keep committing as each unit becomes coherent. Do not pause the sequence for a check run; [CI is read once per settled head](#validate-with-ci-and-overall-self-review).

Close each issue from the commit that earns it. End the commit message with one `Close #n: <issue title>` line per resolved issue, so a commit that resolves several issues carries several lines. GitHub matches the keyword and the number and ignores the title tail, so the line closes the issue normally while the log stays legible without opening each number.

A revert inside the pull request must not carry the closing keyword forward: `git revert` quotes the original subject, so rewrite its default `Revert "Close #n: ..."` without the closing phrase, and drop any `Closes #n` line for that issue from the pull-request body. That does not spare the issue by itself. A squash merge concatenates every commit message into the merge commit body, where the reverted commit's own `Close #n` line still sits, so the merge closes an issue whose fix no longer exists at `HEAD` and [the merge gate](#merge-and-clean-up) has to reopen it.

Immediately after each coherent issue-implementation commit is pushed, start exactly one read-only subagent Individual Self-Review over that commit's parent-to-commit diff. Do not wait for its result or for per-commit CI. Continue the next ready issue immediately while the review runs.

The individual reviewer advises the main agent only. It reports candidate findings for that one commit and never edits, commits, pushes, posts to GitHub, or makes implementation or disposition decisions.

When the result arrives, the main agent adjudicates every candidate and records the Individual Self-Review as one formal GitHub pull-request review with the `COMMENT` event. Name the commit, summarize what landed and which issues it resolved, attach line-specific findings as inline review comments, and put commit-wide findings or a clean result in the review body. This review is the running ledger for a reader who does not read the diff, not a closing mechanism. Do not replace it with an ordinary issue-style pull-request comment.

Individual Self-Review never reduces or substitutes for [Overall Self-Review](#validate-with-ci-and-overall-self-review). One commit cannot expose every cross-file or integrated consequence, and individual reviews do not combine into an overall round. The [review skill](../review/SKILL.md#individual-self-review) owns this boundary.

Each issue remains an evidence and acceptance unit inside the combined diff. Keep its positive, negative, boundary, and regression cases identifiable. Near-100% coverage of changed behavior is required; a green happy path is not completion.

Follow the development skill for test shape and narrow-then-broad local evidence. Do not treat a local build or test result as a substitute for the pull request's ordinary CI acceptance gate. After the source, tests, documentation, fixtures, and generated consequences are ready, run `pnpm format` and include its integrated result in the same pull request.

If implementation disproves, narrows, or externally blocks an issue, reopen the evidence and update the issue and campaign ledger before changing the claimed scope. Do not leave an orphan issue or pretend an unresolved accepted issue was completed.

## Validate With CI And Overall Self-Review

After no ready issue remains, receive and adjudicate every outstanding Individual Self-Review result. Commit and push the formatted integrated snapshot, then let every ordinary pull-request check run. Start the solo Overall Self-Review immediately over that exact base-to-head diff while CI executes.

Submit every Overall Self-Review finding round and the final clean round as a formal GitHub pull-request review with the `COMMENT` event. Attach line-specific findings as inline review comments and summarize round-wide findings or the clean conclusion in the review body. Do not post ordinary issue-style pull-request comments for Self-Review.

Read CI once per settled head. It gates the cycle, not each commit: every pull-request workflow sets `cancel-in-progress`, so the next push cancels an intermediate commit's run and waiting on that run stalls implementation for a discarded result.

CI and review are independent gates:

- CI must prove every configured build, type-check, test, packaging, and platform lane.
- Overall Self-Review must prove requirement fidelity, consequence coverage, issue-by-issue acceptance, test quality, documentation, generated output, and risks not encoded in CI.

When either gate finds a defect:

1. Diagnose the real cause from the CI log or review evidence.
2. Correct the source and complete the corresponding regression coverage.
3. Run `pnpm format`.
4. Commit and push the correction to the same pull request.
5. Immediately start exactly one Individual Self-Review for that correction commit without waiting for it or per-commit CI.
6. Adjudicate and record the individual result when it arrives, let the new CI run to completion, and restart Overall Self-Review as a fresh complete round over the new head.

Fix every red CI lane in the same pull request even when the failure predates the campaign or is unrelated to the campaign's original issues. Do not dismiss it as another contributor's failure.

Do not merge a head whose green checks belong to an older SHA, whose clean Overall Self-Review predates a correction, or whose required Individual Self-Review result remains unrecorded. Continue the loop until the same immutable head has green required checks and a complete Overall Self-Review round with no sound improvement.

## Merge And Clean Up

Merge only with user authorization, including a campaign-local standing authorization that explicitly covers merge.

Before merging, reconcile the closing keywords against what survives at `HEAD`. `git log origin/master..HEAD` shows every message the squash will concatenate, including commits a later one reverted, so read the whole range and confirm each issue the merge will close has a surviving fix.

After merge:

1. Verify GitHub records the pull request as merged into the intended target and every linked issue has the correct final state. Reopen any issue the squash merge closed without a surviving fix, and comment that the merge closed it mechanically.
2. Confirm the checkout has no unpushed or uncommitted work worth preserving.
3. Switch back to the target branch, pull with `git pull --ff-only`, and delete the local topic branch.
4. For every assignment-created external path, confirm no live process or other assignment uses it, preserve required evidence, delete only the exact proven path, and verify it is absent.
5. Never bulk-delete a shared temporary directory, global `GOCACHE`, `GOMODCACHE`, an installed Go toolchain, or an asset whose ownership is uncertain.

Formatting belongs to the unified cycle pull request, so a separate post-campaign formatting pull request is not part of this solo workflow.

## Repeat Until A Clean Round

After every merged cycle, return to the parent skill's Discover Issues phase and start the next cycle against the new integrated state.

If any meaningful candidate survives fact-checking, adjudicate and publish it when authorized, accumulate it in the next cycle ledger, and run another complete fresh full-scope round against that same pre-development state. Repeat discovery without a fixed round limit and do not claim the next pull request until a subsequent complete round is empty.

After the empty-round gate passes, claim the next single cycle pull request containing every implementation-ready issue accumulated by the preceding nonempty rounds. If the gate passes with no accepted issue to implement, finish the remaining cleanup and evaluate the completion conditions below.

The campaign succeeds only when all of these are true:

- one complete fresh full-scope discovery round produces no meaningful candidate after fact-checking;
- no accepted or published campaign issue remains unresolved;
- no campaign pull request, branch, process, or assignment-owned temporary asset remains; and
- the target checkout is clean and synchronized.

If an external blocker makes those conditions impossible, report the campaign as blocked rather than complete.
