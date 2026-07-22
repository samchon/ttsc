# Multi-Agent Issue Campaign

Read this document only through the multi-agent skill for an explicitly parallel issue campaign. Read the base issue-campaign, project, development, pull-request, review, and [multi-agent review](review.md) procedures before acting.

The base issue-campaign skill owns authorization, the knowledge base, candidate adjudication, self-contained issue bodies, and the clean full-scope completion gate. This document overrides only discovery and implementation topology.

## Select The Parallel Boundary

A multi-agent issue campaign parallelizes both discovery and implementation by default.

Switch to parallel discovery with solo implementation only when the user explicitly requests that combination. In that mode:

1. Run Parallel Discovery repeatedly against the recorded pre-development integrated state until one complete parallel round is empty. Let the lead adjudicate every round and publish accepted issues when authorized.
2. Stop every discovery agent only after the empty-round development gate passes.
3. If the gate passes with no accepted issue, skip implementation and evaluate [Completion](#completion).
4. Otherwise read the base issue campaign's [solo development procedure](../issue-campaign/development.md).
5. Put every implementation-ready issue into its one empty-claim pull request, use the current checkout without a worktree, run `pnpm format`, validate through ordinary CI, and complete solo Self-Review while CI runs.
6. Apply that procedure's implementation, CI, merge, branch cleanup, and temporary-asset rules, but return here for the next parallel discovery round instead of switching to solo discovery.

Do not infer solo implementation from quota concerns, a small issue count, or the fact that the lead performs publication. Only the user's explicit phase boundary selects it.

## Parallel Discovery

Use [review.md](review.md)'s Parallel Issue Discovery Rounds. Every discovery agent audits the whole declared scope independently. The lead alone fact-checks and publishes.

Pool raw candidates in `.wiki`, then reproduce and combine, split, rewrite, reject, or defer them before publication. Parallel discovery changes evidence breadth, not publication authority.

Keep implementation closed while any meaningful candidate survives a round. Accumulate accepted issues, end the current discovery team, and run another complete parallel full-scope round against the same recorded pre-development integrated state. Begin implementation only after one complete team round is empty and the accumulated accepted issue set is nonempty.

## Build Coarse Implementation Batches

When implementation is also parallel, first confirm the empty-round discovery gate and freeze the accumulated accepted issue set. Recompute the published-issue DAG before every wave. Form the smallest number of maximal cohesive batches that dependency readiness and ownership permit.

Group issues only when they are ready on the same frontier, share an architectural owner or root invariant, overlap in consequence surface, use mostly the same verification, and remain understandable and reversible as one diff. Split for a named dependency, external blocker, repository or target-branch boundary, independent release contract, incompatible verification owner, destructive file overlap, or lost issue-level attribution.

Topic, label, package proximity, reporter, and issue count do not justify a split. Record the original issue count, final pull-request count, DAG edges, grouping reasons, split reasons, owned files, and verification lanes in `.wiki` before opening claims.

Freeze a batch once its empty claim pull request exists. Re-cut an active batch only when correctness, overlap, or invalidated evidence requires a lead decision.

Open only as many implementation agents as there are immediately executable, non-overlapping batches.

## Claim And Implement Parallel Batches

For each immediately executable batch:

1. Create one isolated worktree and topic branch.
2. Create `<worktree>/.campaign-tmp/go-cache` and `<worktree>/.campaign-tmp/go-tmp`. Every Go command for that batch must set `GOCACHE` and `GOTMPDIR` to those exact directories.
3. Create an implementation-free commit with `git commit --allow-empty`.
4. Push and open a draft pull request linking every batch issue and stating its owned files.
5. Cancel that exact branch's queued or running campaign Actions and record the terminal cancellation state. Never disable repository Actions or a workflow, and never cancel another branch's run.
6. Install dependencies asynchronously when needed, then implement the full consequence surface and near-100% positive, negative, boundary, and regression coverage.
7. Commit and push coherent increments, cancelling only the new runs for that exact branch.
8. Run the narrowest local proving commands followed by the broader locally owned lanes.
9. Freeze the head and complete solo Self-Review. If code changes, rerun the necessary local gates and restart the full review.
10. Let the lead independently verify issue fit, dispositions, evidence, and batch scope.
11. If any campaign pull-request run reaches red, diagnose and repair it in the same pull request, then commit and push the repair even when the failure predates the campaign or is unrelated to its original issues.
12. Merge only with user authorization after local verification, lead review, the final campaign-run cancellation record, and any red-CI repair are complete.

Measure each batch from its empty pull request's GitHub `createdAt` through `mergedAt`, including installation, dependency waiting, implementation, validation, review, rebases, cancellation, and merge. Keep outliers and record issue count beside the duration.

Start long local commands asynchronously and continue useful independent work. Do not reserve an agent solely to watch installation, build, test, CI, or cancellation.

When batches overlap unexpectedly, stop the later mutation, report the exact file and invariant conflict, and let the lead serialize or re-cut the work. Agents never edit another batch's owned files.

## Integrated Cleanup

After every parallel implementation batch is resolved and its worktree and external assets are removed:

1. Create one cleanup worktree and topic branch from the integrated target.
2. Install dependencies when needed and run `pnpm format`.
3. Run the full integrated local validation required by the project skill.
4. If formatting changes files, open one ordinary cleanup pull request, let all CI checks run, and perform solo Self-Review while they run.
5. Repair every CI or review finding in the same cleanup pull request, including a red lane unrelated to the campaign's original changes, and repeat until the same head is green and clean.
6. Merge with authorization, then remove the cleanup worktree, branch, and assignment-owned external assets.
7. If formatting produces no diff, complete solo Self-Review over the integrated target, then remove the unused cleanup worktree and branch without opening a pull request.

## Completion

After the selected implementation flow is resolved, start the next cycle against the integrated repository. Repeat complete parallel full-scope rounds against that state until a full team round is empty, accumulating every accepted issue before any new implementation begins.

The campaign succeeds only when every reviewer completes the whole scope, no meaningful candidate survives lead verification, no accepted issue remains unresolved, and every campaign worktree and assignment-owned temporary asset is removed. Report an external blocker as blocked, not complete.
