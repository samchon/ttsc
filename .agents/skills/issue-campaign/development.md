# Campaign Development

Read this document in full when the user authorizes implementation pull requests or ends a campaign that entered implementation. Also read the repository development, pull-request, and review skills before acting.

## Flow

- [Cancel Implementation-Wave CI](#cancel-implementation-wave-ci)
- [Admit And Reserve A Pull Request Wave](#admit-and-reserve-a-pull-request-wave)
- [Keep Working While Commands Run](#keep-working-while-commands-run)
- [Implement And Revalidate A Batch](#implement-and-revalidate-a-batch)
- [Remove Every Finished Worktree](#remove-every-finished-worktree)
- [While Campaign CI Is Cancelled](#while-campaign-ci-is-cancelled)
- [Repeat A Campaign Cycle](#repeat-a-campaign-cycle)
- [Post-Campaign Cleanup](#post-campaign-cleanup)

Three rules govern the entire implementation phase:

- Local tests, lead verification, and solo Self-Review are the implementation gates.
- Do not run `pnpm format` during discovery, issue publication, or implementation. Post-Campaign Cleanup owns the repository-wide formatter result.
- Never disable repository Actions or any workflow for a campaign. After every implementation-wave push and pull-request creation, immediately start cancellation only for runs caused by that campaign commit. Keep the cancellation record current and complete it before merge, but do not make local development wait for it.

## Cancel Implementation-Wave CI

Repository-wide Actions and workflow settings must remain unchanged. Before the first push, record `gh api repos/{owner}/{repo}/actions/permissions` and `gh workflow list --all --limit 1000 --json id,name,path,state` in `.wiki/<campaign>/ci-state.md` so the lead can prove the campaign did not alter them.

Every implementation-wave push gets a cancellation record. Start it immediately in a background supervisor rather than leaving an implementation agent to poll it:

1. Record the campaign branch and pushed commit SHA.
2. List runs for that exact SHA with `gh run list --commit <sha> --limit 100 --json databaseId,headBranch,headSha,status,conclusion,url`.
3. Cancel every `queued`, `in_progress`, `waiting`, `pending`, or `requested` run for that SHA with `gh run cancel <run-id>`. Never cancel by broad repository, workflow, or contributor filters.
4. Poll again because push, pull-request, chained, and ruleset runs can appear after the first query. Continue until two consecutive polls find no new run and every observed run is terminal; every run observed as active must end `cancelled`, while a run already terminal when first observed is only recorded.
5. Record the run IDs and final states in `.wiki/<campaign>/ci-state.md`. If enumeration, cancellation, or readback fails, surface the failure and suspend later remote mutations and merge until it is repaired.

Opening or updating an implementation pull request can enqueue additional runs for the already-pushed SHA. Start the same background record immediately after pull-request creation and after any operation that retriggers checks. The exact-SHA boundary is mandatory: never cancel unrelated contributors' runs.

A live cancellation record does not block reading source, changing code, writing tests, starting local commands, committing, or Self-Review. It is a merge gate, not an excuse to idle. The initial claim push and the immediately following claim pull request are one reservation transaction, so opening that pull request does not wait for the first poll. Before merge, read every campaign SHA record back and require the final terminal state described above.

## Admit And Reserve A Pull Request Wave

Only an admitted issue can enter implementation. The lead first reopens the issue evidence, reproduces the reported behavior, verifies ownership and the full consequence surface, compares related open and closed work, and records an accept, partial acceptance, rewrite, combine, split, reject, or defer disposition. A rejected or deferred issue has no worktree and no claim pull request.

Build the dependency DAG from the admitted issues before assigning implementation. Use it to form cohesive batches, not to create one worktree per issue.

Batching follows these rules:

- Group dependency-ready issues when their change surfaces and verification are compatible.
- Assign one batch to one agent, worktree, branch, and pull request.
- Split jointly implementable issues only for a concrete dependency, ownership, atomicity, or validation reason. Record that reason in the campaign knowledge base.
- Immediately before claiming a batch, check again for an overlapping implementation pull request or branch.

The agent assigned an admitted batch reserves its surface before installing dependencies or writing implementation code:

1. Create one isolated worktree and topic branch.
2. Create one implementation-free claim commit with `git commit --allow-empty`.
3. Push the branch, start its exact-SHA cancellation record, and immediately open a draft claim pull request that overviews the batch scope and links every batched issue. This is an empty reservation pull request, not a request to wait for setup or validation.
4. Start the pull-request-triggered cancellation record, mark verification as pending, and record the batch, worktree, branch, issues, pull request, and cancellation records in the campaign knowledge base.
5. Start `pnpm install` asynchronously in the worktree, then begin the source, consequence-surface, and test-design work immediately.

The draft pull request reserves the whole batch before code is written, preventing another contributor from starting overlapping work.

## Keep Working While Commands Run

Start every long command asynchronously and continue with work that does not depend on its result. `pnpm install`, package builds, compiler downloads, and test suites are all background work. Watching a CLI process, repeatedly polling it without a decision to make, or reserving an agent solely to wait is not campaign work.

Maintain a compact command record containing the command, worktree, source snapshot, start time, dependent decision, and final result. Check a running command at a genuine decision boundary, when it exits, or before merge. Do not use sleep loops or foreground waits merely to discover that a command is still running.

The usual overlap follows the state of the batch. While installation runs, read the admitted issue and nearby implementation, map the consequence surface, and write the implementation and regression test. Once a stable source-and-test snapshot is committed and pushed, launch the narrow package-scoped tests and begin Self-Review at once. A test process may run during review because it does not change the snapshot. When several independent checks are needed, start them together rather than serially discovering that each needs the same environment.

Some boundaries remain strict because overlap would destroy the evidence:

- **A Self-Review round must not race a source change.** Freeze and commit the snapshot before opening the round, then inspect its complete diff while tests run. If review or a test result requires a change, commit the correction and restart from a fresh complete round over the new snapshot.
- **A merge must not precede its evidence.** Local verification is the only gate a CI-suspended campaign has, so every required result and cancellation record must be final before merge.
- **A failed cancellation record stops remote progression, not local thought.** Repair it before the next remote mutation or merge, while the agent continues the local work that is still safe and useful.

Report any command still running, its dependency, and its last observed state when handing work off. Waiting is only justified when the next decision genuinely depends on the completed result and no safe, independent work remains.

## Implement And Revalidate A Batch

Analyze the full consequence and case surface across every issue in the batch. Follow the repository development skill for implementation, tests, documentation, generated artifacts, and narrow-then-broad local verification.

A batch progresses through one-way states: admitted, reserved, active, snapshotted, reviewed, verified, then resolved. Admission is the lead's evidence-based decision. Reservation is the empty claim pull request. Active work begins as installation runs. Snapshot means the implementation and its tests are committed and pushed, not that their background processes have finished. Review starts on that immutable snapshot while narrow tests run. Verification consumes every required result, applies any correction through a new snapshot and fresh review, and only then permits resolution.

An implementation agent may find that an issue is false or too broad. The lead must independently validate that conclusion before changing campaign state:

- For a narrowed issue, record the evidence on the issue and pull-request thread, then update the batch scope.
- For a confirmed-invalid issue, record the evidence and close the issue.
- If no issue remains in the batch, close the claim pull request instead of leaving an orphan reservation.

Commit and push every coherent implementation increment to the claimed branch as soon as its source and test program are complete. Do not hold a completed snapshot locally while waiting for the tests it already launched. Start the exact-SHA cancellation record immediately after the push, consume the test results when they become available, and make any correction in a new commit with the same discipline.

Before merge, complete solo Self-Review. When a round finds an improvement, comment its findings and remediation plan on the pull request before applying the change so the thread records why every follow-up commit happened. A pending narrow test never delays the start of that review, but its final result is required before merge. The implementing agent then merges its own pull request with the repository's established method, with no separate lead approval, once implementation, that Self-Review, the batch's package-scoped local verification, and all campaign cancellation records are complete. Under an ordinary campaign it waits for explicit user authorization; under a standing autonomous mandate, an autonomous or remote-control campaign, or an instruction to carry the campaign through merge, it merges as soon as those gates pass without a per-pull-request request.

## Remove Every Finished Worktree

Worktree removal is part of finishing an assignment, not optional housekeeping.

After a pull request merges:

1. Verify GitHub records it as merged into the intended target. This works for merge, squash, and rebase strategies.
2. Confirm the worktree has no unpushed or uncommitted work worth preserving.
3. Run `git worktree remove --force <path>` so ignored build artifacts are deleted too.
4. Verify the directory no longer exists.
5. Run `git worktree prune` and delete the local topic branch.
6. Confirm `git worktree list --porcelain` contains no record of the removed path.

If an assignment ends without a merge, first record retained evidence and confirm the remaining contents are disposable. Then remove its worktree and local branch by the same standard.

Apply this rule to every campaign-created worktree, including one used for Post-Campaign Cleanup. Do not mark an assignment complete while its worktree remains on disk.

## While Campaign CI Is Cancelled

- Record local verification for each pull request. Do not dispatch replacement CI.
- Keep repository Actions and workflow settings unchanged. Cancel only exact-SHA campaign runs after every push or pull-request retrigger.
- If work pauses, report local verification and the final state of every run for the latest campaign SHAs.

## Repeat A Campaign Cycle

Report the wave after every surviving issue is covered by its assigned batch pull request.

When the user requests another discovery cycle, return to the parent skill's Discover Issues phase and start new unlimited full rounds over the entire campaign scope. Earlier rounds are not coverage. Repository Actions remains unchanged, and discovery alone does not authorize issue publication, pull requests, or merging.

## Post-Campaign Cleanup

Run this phase only after the user ends the campaign, every campaign pull request is resolved, every campaign worktree is removed, and no campaign branch needs another push.

1. Return to `master` in the main checkout and confirm it contains no unrelated user changes.
2. Pull the final campaign result with `git pull --ff-only origin master`.
3. Run `pnpm format` once against the integrated repository.
4. If formatting produces no diff, report that no cleanup pull request was needed and stop.
5. If formatting changes files, create a dedicated topic branch containing the formatter result and only directly necessary fixes.
6. Commit, push, and open the Post-Campaign Cleanup pull request under the pull-request skill. This is an ordinary pull request: resume its check loop instead of cancelling its runs.
7. Diagnose any locally reproducible failure, fix it, commit, push, and resume the ordinary check loop.
8. Merge once required checks pass: with explicit user authorization, or on a standing autonomous mandate without a separate request.
9. If cleanup used the main checkout, return it to `master`, pull with `git pull --ff-only origin master`, and delete the local cleanup branch.
10. If cleanup used an auxiliary worktree, remove it and its branch under Remove Every Finished Worktree, then pull `master` in the main checkout.
11. Require the main checkout to be clean. Compare the final repository Actions permission and workflow inventory with the initial record and require that the campaign made no change.
