---
name: pull-request
description: Pull request submission flow. Read only when the user explicitly asks for a pull request.
---

# Pull Request Submission

Only act on this skill when the user explicitly asks for a pull request. Never open, propose, or push a new PR on your own initiative, not as a "helpful" follow-up to a finished change, not because the work looks done. (This bounds PR creation only; it does not change how you commit to a branch.) When the user does ask, follow this flow.

## Branch from the target

Branch from the PR target (`master` unless stated otherwise); never commit to the target directly. Name the branch to reflect the change: `feat/<scope>`, `fix/<scope>`, `ci/<scope>`.

## Group changes into logical commits

Group changes into logical commits. One per coherent unit, not a single mega-commit when the diff is large. Use the repository's existing `<type>(<scope>): <subject>` message style. Run `pnpm format` before each commit (see `development/SKILL.md` § Work Rules).

## Write the PR body at open

Write the PR body at open: intent, scope, deferred items, test plan. Treat it as the PR's historical intent statement. Do not rewrite the body on every follow-up push, subsequent CI fixes, newly-found design issues, and deferred-item promotions go in `gh pr comment` instead. The comment thread is the PR's chronology.

## Watch checks after every push

After every push, watch `gh pr checks <PR>` with the Monitor tool until each check settles. Do not poll manually; the notification arrives when transitions complete. On failure, fetch the job log via `gh api repos/<owner>/<repo>/actions/jobs/<job-id>/logs` (returns the full log when `gh run view --log-failed` is empty), diagnose, fix in place, push as a new commit, and let the monitor resume.

## Merge only on explicit request

Do not merge, squash-merge, or rebase the target branch on your own initiative. When the user explicitly asks to merge, use the repository's established merge method unless they specify another one.

Before merging, confirm required checks are passing. If a non-required check is known-failing and the user explicitly acknowledges it, merge if GitHub permits it; if branch protection blocks the merge, report the blocker instead of bypassing it.
