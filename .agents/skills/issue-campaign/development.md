# Campaign Development

Read this document in full when the user authorizes implementation pull requests or ends a campaign that entered implementation. Also read the repository development, pull-request, and review skills before acting.

## Flow

- [Cancel Campaign CI After Every Push](#cancel-campaign-ci-after-every-push)
- [Plan And Claim A Pull Request Wave](#plan-and-claim-a-pull-request-wave)
- [Never Idle On A Long Command](#never-idle-on-a-long-command)
- [Implement And Revalidate A Batch](#implement-and-revalidate-a-batch)
- [Remove Every Finished Worktree](#remove-every-finished-worktree)
- [While Campaign CI Is Cancelled](#while-campaign-ci-is-cancelled)
- [Repeat A Campaign Cycle](#repeat-a-campaign-cycle)
- [Post-Campaign Cleanup](#post-campaign-cleanup)

Three rules govern the entire implementation phase:

- Local tests, lead verification, and solo Self-Review are the implementation gates.
- Do not run `pnpm format` during discovery, issue publication, or implementation. Post-Campaign Cleanup owns the repository-wide formatter result.
- Never disable repository Actions or any workflow for a campaign. After every campaign push and pull-request creation, immediately cancel only the runs for that campaign commit and verify cancellation before continuing.

## Cancel Campaign CI After Every Push

Repository-wide Actions and workflow settings must remain unchanged. Before the first push, record `gh api repos/{owner}/{repo}/actions/permissions` and `gh workflow list --all --limit 1000 --json id,name,path,state` in `.wiki/<campaign>/ci-state.md` so the lead can prove the campaign did not alter them.

Every push gets its own cancellation gate:

1. Record the campaign branch and pushed commit SHA.
2. List runs for that exact SHA with `gh run list --commit <sha> --limit 100 --json databaseId,headBranch,headSha,status,conclusion,url`.
3. Cancel every `queued`, `in_progress`, `waiting`, `pending`, or `requested` run for that SHA with `gh run cancel <run-id>`. Never cancel by broad repository, workflow, or contributor filters.
4. Poll again because push, pull-request, chained, and ruleset runs can appear after the first query. Continue until two consecutive polls find no new run and every observed run is terminal; every run observed as active must end `cancelled`, while a run already terminal when first observed is only recorded.
5. Record the run IDs and final states in `.wiki/<campaign>/ci-state.md`. Stop further pushes or pull-request mutations if enumeration, cancellation, or readback fails.

Opening or updating a pull request can enqueue additional runs for the already-pushed SHA. Run the same gate immediately after pull-request creation and after any operation that retriggers checks. The exact-SHA boundary is mandatory: never cancel unrelated contributors' runs.

## Plan And Claim A Pull Request Wave

Build the issue dependency DAG before assigning implementation. Use it to form cohesive batches, not to create one worktree per issue.

Batching follows these rules:

- Group dependency-ready issues when their change surfaces and verification are compatible.
- Assign one batch to one agent, worktree, branch, and pull request.
- Split jointly implementable issues only for a concrete dependency, ownership, atomicity, or validation reason. Record that reason in the campaign knowledge base.
- Immediately before claiming a batch, check again for an overlapping implementation pull request or branch.

The agent assigned a batch claims it as its first action, before writing any code:

1. Create one isolated worktree and topic branch.
2. Create one implementation-free claim commit with `git commit --allow-empty`.
3. Push the branch and pass the exact-SHA cancellation gate.
4. Open a draft pull request that overviews the batch scope and links every batched issue, then pass the gate again for runs triggered by pull-request creation.
5. Mark verification as pending, and record the batch, worktree, branch, issues, pull request, and cancelled run IDs in the campaign knowledge base.

The draft pull request reserves the whole batch before code is written, preventing another contributor from starting overlapping work.

## Never Idle On A Long Command

Start every long command in the background and keep working. Idle waiting is the campaign's largest avoidable cost, and parallel batches multiply it: an agent that watches `pnpm install`, a build, or a suite finish before doing anything else spends most of its wall clock producing nothing.

Overlap by default:

- **Claim before setup finishes.** The claim commit, push, cancellation gate, and draft pull request need no installed dependencies, and claiming first is what reserves the surface while setup runs.
- **Read and implement against the source tree.** Reading the batch's issues, mapping the consequence surface, and writing the change need the repository, not `node_modules`.
- **Fill a verification wait with work that does not consume its result.** The next test, the next issue in the batch, the pull-request record, or the gate table for a push already made are all independent of the command in flight.
- **Batch the dependent work.** When several checks must run, start them together rather than serially discovering that each needs the previous one's environment.

These must never be overlapped, because overlapping them destroys the evidence they exist to produce:

- **A Self-Review round must not race a change.** The review skill requires one complete round over a final surface and a restart whenever anything changes, so a round begun while the code can still move is not a round at all. Prepare its inputs early — the base-to-head diff inventory, consequence-surface notes, the list of generated artifacts to re-check — and open the round once the batch stops changing.
- **A merge must not precede its evidence.** Local verification is the only gate a CI-suspended campaign has, so a result that lands after the merge proves nothing about what was merged.
- **The cancellation gate is a barrier, not a slow command.** [Cancel Campaign CI After Every Push](#cancel-campaign-ci-after-every-push) already forbids continuing while a gate is unresolved; nothing in this section relaxes that. Poll it to completion before doing anything else.

Report wall-clock honestly when a wait was unavoidable, such as a toolchain download or a suite with no narrower subset. An unavoidable wait is a fact; an unexamined one is a habit.

## Implement And Revalidate A Batch

Analyze the full consequence and case surface across every issue in the batch. Follow the repository development skill for implementation, tests, documentation, generated artifacts, and narrow-then-broad local verification.

An implementation agent may find that an issue is false or too broad. The lead must independently validate that conclusion before changing campaign state:

- For a narrowed issue, record the evidence on the issue and pull-request thread, then update the batch scope.
- For a confirmed-invalid issue, record the evidence and close the issue.
- If no issue remains in the batch, close the claim pull request instead of leaving an orphan reservation.

Commit and push every coherent implementation increment to the claimed branch. Immediately pass the exact-SHA cancellation gate after each push; do not hold a completed implementation locally until handoff or continue working while that gate is unresolved.

Before merge, complete solo Self-Review, opening each round by commenting its findings and remediation plan on the pull request before acting on them so the thread records why every follow-up change happened. The implementing agent then merges its own pull request with the repository's established method — no separate lead approval — once implementation, that Self-Review, and the batch's package-scoped local verification all pass. Under an ordinary campaign it waits for explicit user authorization; under a standing autonomous mandate — an autonomous or remote-control campaign, or an instruction to carry the campaign through merge — it merges as soon as those gates pass, without a per-pull-request request.

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
6. Commit and push under the pull-request skill, pass the exact-SHA cancellation gate, open the Post-Campaign Cleanup pull request, and pass the gate again for pull-request-triggered runs.
7. Diagnose any locally reproducible failure, fix it, commit, push, and cancel the new commit's runs by the same gate.
8. Merge once required checks pass: with explicit user authorization, or on a standing autonomous mandate without a separate request.
9. If cleanup used the main checkout, return it to `master`, pull with `git pull --ff-only origin master`, and delete the local cleanup branch.
10. If cleanup used an auxiliary worktree, remove it and its branch under Remove Every Finished Worktree, then pull `master` in the main checkout.
11. Require the main checkout to be clean. Compare the final repository Actions permission and workflow inventory with the initial record and require that the campaign made no change.
