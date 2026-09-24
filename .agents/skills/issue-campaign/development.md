# Campaign Development

Read this document in full when the user authorizes implementation of an issue campaign, or the end of a campaign that entered implementation. Also read the development, pull-request, and review skills before acting. Implementation starts only after the cycle's empty-round gate in the [campaign skill's discovery rounds](SKILL.md#discovery-rounds) passes.

## Flow

- [Plan One Cycle Pull Request](#plan-one-cycle-pull-request)
- [Claim The Complete Cycle](#claim-the-complete-cycle)
- [Implement And Write Tests](#implement-and-write-tests)
- [Validate With CI And Overall Self-Review](#validate-with-ci-and-overall-self-review)
- [Merge And Clean Up](#merge-and-clean-up)
- [Start The Next Cycle](#start-the-next-cycle)

## Plan One Cycle Pull Request

Confirm the discovery gate before planning or claiming work. The campaign ledger must identify the cycle baseline, every complete discovery round against it, the last round's empty result, and the accepted issue set accumulated across preceding nonempty rounds. Fetch the target branch and compare it with that baseline. If the last complete round is not empty or the target advanced, synchronize the target checkout, record the new baseline, and return to discovery instead of opening development.

Put every accepted, implementation-ready issue of the cycle into the one cycle pull request. Recompute the published-issue dependency DAG after publication: it sets safe edit order and shows when one fix can expose another, but it never splits ready issues into separate pull requests.

Build the cycle scope in this order:

1. Reopen every published, unclaimed issue and verify it still belongs to this repository and campaign.
2. Remove only issues proved duplicate, invalid, out of scope, or externally blocked, and record the exact disposition. An accepted unresolved issue prevents campaign completion.
3. Check open pull requests and remote branches for overlapping work before claiming.
4. Put every remaining issue into one cycle ledger with its acceptance matrix, consequence surface, affected files, and DAG predecessors.
5. Record the issue count before grouping and the result as one pull-request unit.

Different packages, invariants, or validation lanes do not split the cycle. Keep issue-level commits when that improves diagnosis, but the cycle pull request remains the unit.

An issue whose only predecessor is another issue in the same cycle is implementation-ready for this purpose. Order the edits through the DAG instead of deferring it to another pull request.

Difficulty never removes an issue from the cycle. When a resolution needs a judgment call about design, invariant ownership, or an acceptable behavior change, settle it from the issue's evidence and implement that decision inside the cycle. A proved duplicate, an invalid premise, an out-of-scope finding, and an external blocker remain the only dispositions that remove one.

## Claim The Complete Cycle

Claim the whole cycle before implementation:

1. Use the current checkout, confirm the target branch still matches the cycle baseline, and create one topic branch from that exact state. Do not create a clone or worktree.
2. Create one implementation-free commit with `git commit --allow-empty`.
3. Push the branch and open one draft pull request.
4. Reference every cycle issue by number, mark verification pending, and state that the pull request owns the complete accepted cycle.
5. Record the checkout, branch, pull request, head SHA, issue set, and external temporary-asset ledger in `.wiki`.

Keep every closing keyword out of the claim body. The body is written before any code exists, so a claim-time closing list closes whatever the cycle later drops, defers, or disproves, burying the analysis those issues carry. The cycle's closing set is the union of the [commit closing lines](#implement-and-write-tests), which makes the merge close exactly what landed.

The empty pull request prevents overlapping contributor work before code is written. Measure official duration from its GitHub `createdAt` timestamp through `mergedAt`, including implementation, CI, review, fixes, rebases, and merge.

## Implement And Write Tests

Work through the DAG on the claimed topic branch. Map the full consequence and case surface across every issue through the development skill's [consequence analysis](../development/SKILL.md#consequence-analysis) before editing, then implement the complete cycle and its tests.

Implement without interruption. Write each piece's tests as that piece lands instead of leaving the tests for the end of the cycle, and keep committing as each unit becomes coherent. Do not pause the sequence for a check run; [CI gates the integrated head](#validate-with-ci-and-overall-self-review), not each commit.

Close each issue from the commit that earns it. End the commit message with one `Close #n: <issue title>` line per resolved issue, so a commit that resolves several issues carries several lines. GitHub matches the keyword and the number and ignores the title tail, so the line closes the issue normally while the log stays legible without opening each number.

A revert inside the pull request must not carry the closing keyword forward: `git revert` quotes the original subject, so rewrite its default `Revert "Close #n: ..."` without the closing phrase, and drop any `Closes #n` line for that issue from the pull-request body. That does not spare the issue by itself. A squash merge concatenates every commit message into the merge commit body, where the reverted commit's own `Close #n` line still sits, so the merge closes an issue whose fix no longer exists at `HEAD` and [the merge gate](#merge-and-clean-up) has to reopen it.

After each coherent issue-implementation commit is pushed, perform its [Individual Self-Review](../review/SKILL.md#individual-self-review) over that commit's parent-to-commit diff without waiting for per-commit CI, then continue with the next ready issue.

Record each Individual Self-Review as one formal GitHub pull-request review with the `COMMENT` event. Name the commit, summarize what landed and which issues it resolved, attach line-specific findings as inline review comments, and put commit-wide findings or a clean result in the review body. This review is the running ledger for a reader who does not read the diff, not a closing mechanism. Do not replace it with an ordinary issue-style pull-request comment.

Each issue remains an evidence and acceptance unit inside the combined diff. Keep its positive, negative, boundary, and regression cases identifiable. Near-100% coverage of changed behavior is required; a green happy path is not completion.

Follow the development skill for test shape and narrow-then-broad local evidence. Do not treat a local build or test result as a substitute for the pull request's ordinary CI acceptance gate. After the source, tests, documentation, fixtures, and generated consequences are ready, run `pnpm format` and include its integrated result in the same pull request.

If implementation disproves, narrows, or externally blocks an issue, reopen the evidence and update the issue and campaign ledger before changing the claimed scope. Do not leave an orphan issue or pretend an unresolved accepted issue was completed.

## Validate With CI And Overall Self-Review

After no ready issue remains and every Individual Self-Review is recorded, commit and push the formatted integrated snapshot, then let every ordinary pull-request check run. Start the Overall Self-Review immediately over that exact base-to-head diff while CI executes, and read the checks as the pull-request skill's [check procedure](../pull-request/SKILL.md#read-checks) requires.

Submit every Overall Self-Review finding round and the final clean round as a formal GitHub pull-request review with the `COMMENT` event. Attach line-specific findings as inline review comments and summarize round-wide findings or the clean conclusion in the review body. Do not post ordinary issue-style pull-request comments for Self-Review.

CI gates the integrated head, not each commit. A push cancels the previous head's run, as the [check procedure](../pull-request/SKILL.md#read-checks) explains, so waiting on an intermediate commit's run stalls implementation for a discarded result.

CI and review are independent gates:

- CI must prove every configured build, type-check, test, packaging, and platform check.
- Overall Self-Review must prove requirement fidelity, consequence coverage, issue-by-issue acceptance, test quality, documentation, generated output, and risks not encoded in CI.

When either gate produces defects, apply one correction for the whole set:

1. Collect every finding of the complete Overall Self-Review round and every failed check of the settled head.
2. Map the whole set through the development skill's [consequence analysis](../development/SKILL.md#consequence-analysis).
3. Correct the source and complete the regression coverage for every case in the resulting case matrix.
4. Run `pnpm format`.
5. Commit and push the correction to the same pull request.
6. Perform and record the Individual Self-Review of that correction commit.
7. Restart Overall Self-Review as a fresh complete round over the new head while its CI runs.

Fix every failed check in the same pull request even when the failure predates the campaign or is unrelated to the campaign's original issues. Do not dismiss it as another contributor's failure.

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

Formatting belongs to the cycle pull request, so a separate post-campaign formatting pull request is not part of this workflow.

## Start The Next Cycle

After every merged cycle, return to the campaign skill's [discovery rounds](SKILL.md#discovery-rounds) against the new cycle baseline. Claim the next cycle pull request only after a later complete round is empty, and include every implementation-ready issue the preceding nonempty rounds accumulated. If the gate passes with no accepted issue left, finish the remaining cleanup and evaluate the [completion conditions](SKILL.md#completion).
