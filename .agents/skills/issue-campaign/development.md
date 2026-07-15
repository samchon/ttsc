# Campaign Development

Read this document in full when the user authorizes implementation pull requests or ends a campaign that entered implementation. Also read the repository development, pull-request, and review skills before acting.

## Flow

- [Suspend Repository Actions](#suspend-repository-actions)
- [Plan And Claim A Pull Request Wave](#plan-and-claim-a-pull-request-wave)
- [Implement And Revalidate A Batch](#implement-and-revalidate-a-batch)
- [Remove Every Finished Worktree](#remove-every-finished-worktree)
- [While Actions Are Suspended](#while-actions-are-suspended)
- [Repeat A Campaign Cycle](#repeat-a-campaign-cycle)
- [Post-Campaign Cleanup](#post-campaign-cleanup)

Three rules govern the entire implementation phase:

- Local tests, lead verification, and solo Self-Review are the implementation gates.
- Do not run `pnpm format` during discovery, issue publication, or implementation. Post-Campaign Cleanup owns the repository-wide formatter result.
- Disable repository Actions before the first campaign push. Keep Actions disabled through every implementation push, pull request, review fix, merge, and renewed discovery cycle.

## Suspend Repository Actions

Disable GitHub Actions at repository level before the first campaign branch push. This gate covers existing workflows, workflows first introduced by a campaign branch, chained events, and ruleset-required Actions workflows.

Do not substitute per-workflow disabling, draft pull requests, concurrency groups, path filters, or commit-message skip markers. Any of them can leave a path that consumes runners.

### Shutdown Gate

1. Confirm the repository and default branch. Record `gh workflow list --all --limit 1000 --json id,name,path,state` in `.wiki/<campaign>/ci-state.md`.
2. Save `gh api repos/{owner}/{repo}/actions/permissions` verbatim as `.wiki/<campaign>/actions-permissions.json`.
3. If `allowed_actions` is `selected`, also save `/actions/permissions/selected-actions` as `.wiki/<campaign>/selected-actions.json`.
4. Run `gh api --method PUT repos/{owner}/{repo}/actions/permissions -F enabled=false`.
5. Read the permission back and require `enabled: false`. Stop before any push or pull request if the mutation or readback fails.
6. Inspect queued and running workflow runs. Suspension does not cancel an existing run. Cancel only accidental campaign runs, never unrelated contributors' runs.

The repository remains fully suspended, including manual Actions runs, until Post-Campaign Cleanup restores the saved policy.

## Plan And Claim A Pull Request Wave

Build the issue dependency DAG before assigning implementation. Use it to form cohesive batches, not to create one worktree per issue.

Batching follows these rules:

- Group dependency-ready issues when their change surfaces and verification are compatible.
- Assign one batch to one agent, worktree, branch, and pull request.
- Split jointly implementable issues only for a concrete dependency, ownership, atomicity, or validation reason. Record that reason in the campaign knowledge base.
- Immediately before claiming a batch, check again for an overlapping implementation pull request or branch.

Claim each unclaimed batch before implementation begins:

1. Create one isolated worktree and topic branch.
2. Create one implementation-free claim commit with `git commit --allow-empty`.
3. Push the branch and open a draft pull request.
4. Link every batched issue, mark verification as pending, and state the batch scope.
5. Record the batch, worktree, branch, issues, and pull request in the campaign knowledge base.

The draft pull request reserves the whole batch before code is written, preventing another contributor from starting overlapping work.

## Implement And Revalidate A Batch

Analyze the full consequence and case surface across every issue in the batch. Follow the repository development skill for implementation, tests, documentation, generated artifacts, and narrow-then-broad local verification.

An implementation agent may find that an issue is false or too broad. The lead must independently validate that conclusion before changing campaign state:

- For a narrowed issue, record the evidence on the issue and pull-request thread, then update the batch scope.
- For a confirmed-invalid issue, record the evidence and close the issue.
- If no issue remains in the batch, close the claim pull request instead of leaving an orphan reservation.

Commit and push every coherent implementation increment to the claimed branch. Do not hold a completed implementation locally until handoff.

Before merge, complete solo Self-Review. The lead then rechecks issue fit, evidence, verification, and pull-request scope. Merge only with user authorization.

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

## While Actions Are Suspended

- Record local verification for each pull request. Do not dispatch replacement CI.
- Before and after every push, require `enabled: false` and verify that no campaign workflow started. Stop publication on any mismatch.
- If work pauses, report the saved and live settings. Leave Actions suspended until the campaign resumes or terminates.

## Repeat A Campaign Cycle

Report the wave after every surviving issue is covered by its assigned batch pull request.

When the user requests another discovery cycle, return to the parent skill's Discover Issues phase and start new unlimited full rounds over the entire campaign scope. Earlier rounds are not coverage. Actions stays disabled, and discovery alone does not authorize issue publication, pull requests, or merging.

## Post-Campaign Cleanup

Run this phase only after the user ends the campaign, every campaign pull request is resolved, every campaign worktree is removed, and no campaign branch needs another push.

1. Return to `master` in the main checkout and confirm it contains no unrelated user changes.
2. Pull the final campaign result with `git pull --ff-only origin master`.
3. Run `pnpm format` once against the integrated repository.
4. If formatting produces no diff, restore the exact saved Actions policy, verify it, report that no cleanup pull request was needed, and stop.
5. If formatting changes files, create a dedicated topic branch containing the formatter result and only directly necessary fixes.
6. Restore and verify the exact saved Actions policy before the first cleanup-branch push. If that policy enables Actions, the cleanup pull request receives normal CI; never enable a repository that was disabled before the campaign.
7. Commit, push, and open the Post-Campaign Cleanup pull request under the pull-request skill.
8. Watch every check. Diagnose every red result, fix it, commit, and push on the same branch until all required checks are green.
9. Merge only with user authorization.
10. If cleanup used the main checkout, return it to `master`, pull with `git pull --ff-only origin master`, and delete the local cleanup branch.
11. If cleanup used an auxiliary worktree, remove it and its branch under Remove Every Finished Worktree, then pull `master` in the main checkout.
12. Require the main checkout to be clean. Read the repository Actions policy back one final time and require it to match the saved policy.

### Restore Actions Exactly

Restoration means returning to the previous policy, not merely setting `enabled=true`.

Restore the saved repository permission:

```powershell
gh api --method PUT repos/{owner}/{repo}/actions/permissions -F enabled=<saved-boolean> -f allowed_actions=<saved-value> -F sha_pinning_required=<saved-boolean>
```

If the saved `allowed_actions` value is `selected`, also restore its selection:

```powershell
gh api --method PUT repos/{owner}/{repo}/actions/permissions/selected-actions --input .wiki/<campaign>/selected-actions.json
```

Compare the live responses with both snapshots. Never broaden the prior policy. Record the final policy and workflow inventory in `.wiki/<campaign>/ci-state.md`.
