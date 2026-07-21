# Solo Campaign Development

Read this document in full when the user authorizes implementation pull requests or the end of a solo issue campaign that entered implementation. Also read the repository development, pull-request, and review skills before acting.

## Flow

- [Plan One Cycle Pull Request](#plan-one-cycle-pull-request)
- [Claim The Complete Cycle](#claim-the-complete-cycle)
- [Implement And Write Tests](#implement-and-write-tests)
- [Validate With CI And Self-Review](#validate-with-ci-and-self-review)
- [Merge And Clean Up](#merge-and-clean-up)
- [Repeat Until A Clean Round](#repeat-until-a-clean-round)

Four rules govern the implementation phase:

- The main agent performs all implementation, test authoring, CI diagnosis, review, and cleanup. Do not spawn or delegate to a subagent.
- Put every accepted, implementation-ready issue in the current cycle into one pull request. The issue DAG controls implementation order inside that pull request, not pull-request count.
- Work in the current checkout and one topic branch. Do not create a clone or worktree for a solo campaign or its Self-Review.
- The pull request's ordinary CI and a clean solo Self-Review are the acceptance gates. Repair every red CI lane in that same pull request, even when the failure predates the campaign or is unrelated to its original issues.

## Plan One Cycle Pull Request

Recompute the published-issue dependency DAG after publication. Record dependencies because they determine safe edit order and when one fix can expose another, but do not partition ready issues into separate pull requests.

Build the cycle scope in this order:

1. Reopen every published, unclaimed issue and verify it still belongs to this repository and campaign.
2. Remove only issues proved duplicate, invalid, out of scope, or externally blocked, and record the exact disposition. An accepted unresolved issue prevents campaign completion.
3. Check open pull requests and remote branches for overlapping work before claiming.
4. Put every remaining issue into one cycle ledger with its acceptance matrix, consequence surface, affected files, and DAG predecessors.
5. Record the issue count before grouping and the result as one pull-request unit.

Different packages, invariants, or validation lanes do not split the solo cycle. Keep issue-level commits when that improves diagnosis, but the pull request remains the integrated campaign unit.

An issue whose only predecessor is another issue in the same cycle is implementation-ready for this purpose. Order the edits through the DAG instead of deferring it to another pull request.

Difficulty never removes an issue from the cycle. When a resolution needs a judgment call about design, invariant ownership, or an acceptable behavior change, settle it from the issue's evidence and implement that decision here. Proved duplicate, invalid premise, out of scope, and external blocker stay the only dispositions that take an issue out of the cycle.

## Claim The Complete Cycle

Claim the whole cycle before implementation:

1. Use the current checkout, update the target branch with `git pull --ff-only`, and create one topic branch. Do not create a clone or worktree.
2. Create one implementation-free commit with `git commit --allow-empty`.
3. Push the branch and open one draft pull request.
4. Reference every cycle issue by number, mark verification pending, and state that the pull request owns the complete accepted cycle.
5. Record the checkout, branch, pull request, head SHA, issue set, and external temporary-asset ledger in `.wiki`.

Reference the issues in the claim body, and keep every closing keyword out of it. The body is written before any code exists, so a claim-time closing list closes whatever the cycle later drops, defers, or disproves and buries the analysis those issues carry. The cycle's closing set is the union of the commit trailers, which makes the merge close exactly what landed.

The empty pull request prevents overlapping contributor work before code is written. Measure official duration from its GitHub `createdAt` timestamp through `mergedAt`, including implementation, CI, review, fixes, rebases, and merge.

## Implement And Write Tests

Work through the DAG on the claimed topic branch. Analyze the full consequence and case surface across every issue before editing, then implement the complete cycle and its tests.

Implement without interruption. Write each piece's tests as that piece lands instead of saving a test pass for the end of the cycle, and keep committing as each unit becomes coherent. Do not pause the sequence for a check run; [CI is read once per settled head](#validate-with-ci-and-self-review).

Close each issue from the commit that earns it. End the commit message with one `Close #n: <issue title>` line per resolved issue, so a commit that resolves several issues carries several lines. GitHub matches the keyword and the number and reads the title tail as free text, which keeps the log legible without opening each issue.

Post a pull-request comment after each commit naming what that commit landed and which issues it resolved. The comment is the running ledger for a reader who does not read the diff, never a closing mechanism: GitHub closes an issue from a commit message or the pull-request body and never from a comment.

Each issue remains an evidence and acceptance unit inside the combined diff. Keep its positive, negative, boundary, and regression cases identifiable. Near-100% coverage of changed behavior is required; a green happy path is not completion.

Follow the development skill for test shape and narrow-then-broad local evidence. Do not treat a local build or test result as a substitute for the pull request's ordinary CI acceptance gate. After the source, tests, documentation, fixtures, and generated consequences are ready, run `pnpm format` and include its integrated result in the same pull request.

If implementation disproves, narrows, or externally blocks an issue, reopen the evidence and update the issue and campaign ledger before changing the claimed scope. Do not leave an orphan issue or pretend an unresolved accepted issue was completed.

## Validate With CI And Self-Review

Commit and push the formatted integrated snapshot, then let every ordinary pull-request check run. Start solo Self-Review immediately over that exact base-to-head diff while CI executes.

Read CI once per settled head. It gates the cycle, not each commit: every pull-request workflow sets `cancel-in-progress`, so the next push cancels an intermediate commit's run and waiting on that run stalls implementation for a discarded result.

CI and review are independent gates:

- CI must prove every configured build, type-check, test, packaging, and platform lane.
- Self-Review must prove requirement fidelity, consequence coverage, issue-by-issue acceptance, test quality, documentation, generated output, and risks not encoded in CI.

When either gate finds a defect:

1. Diagnose the real cause from the CI log or review evidence.
2. Correct the source and complete the corresponding regression coverage.
3. Run `pnpm format`.
4. Commit and push the correction to the same pull request.
5. Let the new CI run to completion and restart Self-Review as a fresh complete round over the new head.

Fix every red CI lane in the same pull request even when the failure predates the campaign or is unrelated to the campaign's original issues. Do not dismiss it as another contributor's failure.

Do not merge a head whose green checks belong to an older SHA or whose clean review predates a correction. Continue the loop until the same immutable head has green required checks and a complete Self-Review round with no sound improvement.

## Merge And Clean Up

Merge only with user authorization, including a campaign-local standing authorization that explicitly covers merge.

After merge:

1. Verify GitHub records the pull request as merged into the intended target and every linked issue has the correct final state.
2. Confirm the checkout has no unpushed or uncommitted work worth preserving.
3. Switch back to the target branch, pull with `git pull --ff-only`, and delete the local topic branch.
4. For every assignment-created external path, confirm no live process or other assignment uses it, preserve required evidence, delete only the exact proven path, and verify it is absent.
5. Never bulk-delete a shared temporary directory, global `GOCACHE`, `GOMODCACHE`, an installed Go toolchain, or an asset whose ownership is uncertain.

Formatting belongs to the unified cycle pull request, so a separate post-campaign formatting pull request is not part of this solo workflow.

## Repeat Until A Clean Round

After every merged cycle, return to the parent skill's Discover Issues phase and perform another complete fresh round over the entire declared scope.

If any meaningful candidate survives fact-checking, adjudicate and publish it when authorized, then claim the next single cycle pull request containing every implementation-ready issue. Repeat discovery, implementation, CI, review, merge, and cleanup without a fixed round limit.

The campaign succeeds only when all of these are true:

- one complete fresh full-scope discovery round produces no meaningful candidate after fact-checking;
- no accepted or published campaign issue remains unresolved;
- no campaign pull request, branch, process, or assignment-owned temporary asset remains; and
- the target checkout is clean and synchronized.

If an external blocker makes those conditions impossible, report the campaign as blocked rather than complete.
