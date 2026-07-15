---
name: pull-request
description: Defines ttsc branch, commit, pull-request, check, and merge workflows. Use only when the user explicitly asks to open, submit, update, or merge a pull request; never open, push, update, or merge one on initiative.
---

# Pull Request Submission

Act on this skill only when the user explicitly requests the corresponding remote action. Permission to edit locally is not permission to push or open a pull request, and permission to open or update is not permission to merge.

## Branch From The Target

Branch from the pull-request target (`master` unless stated otherwise); never commit or push directly to the target. Name the branch for the merged outcome with the repository's established type and scope, such as `feat/<scope>`, `fix/<scope>`, `docs/<scope>`, or `ci/<scope>`.

If the current checkout contains unrelated or protected work, create an isolated worktree from the target branch instead of stashing, reverting, or mixing it.

## Commit Logical Units

Use one commit per coherent unit when the diff is large. Follow the repository's `<type>(<scope>): <subject>` history with an imperative lowercase subject and no trailing period.

Run the validation required by the development skill. Run `pnpm format` before ordinary commits. During an issue campaign, do not run `pnpm format` on implementation branches; the campaign's dedicated Post-Campaign Cleanup pull request owns the repository-wide formatter result.

Stage explicit paths when the worktree is mixed. Never include unrelated user changes silently.

## Write The Pull Request

Write the body at open as the historical intent statement. Include the intent, scope, deferred items, and exact local verification. State skipped checks and disabled campaign CI honestly.

Do not rewrite the body after every follow-up push. Record later CI fixes, newly discovered design issues, and promoted deferred work as comments so the thread preserves chronology. The title describes the merged outcome in Conventional Commits style, not the work process.

Push only the topic branch with upstream tracking. Use a file-backed body for multiline Markdown when opening through `gh`.

## Issue Campaign Override

Before any issue-campaign push or pull request, complete `.agents/skills/issue-campaign/development.md`. Its no-format, local-verification, suspended-Actions, and Post-Campaign Cleanup rules override the ordinary commit and check flow here; cleanup returns to the ordinary check loop after restoring Actions.

## Watch Checks After Every Ordinary Push

After each ordinary push, including every Post-Campaign Cleanup push, monitor the pull-request checks until every check settles. Only CI-suspended campaign implementation waves skip this loop. On failure, fetch the relevant job log, diagnose the real cause, fix it in place, push a new commit, and resume monitoring. Do not treat a green unrelated job as acceptance for a failed required surface.

## Merge Only On Explicit Request

Do not merge, squash-merge, rebase, or update the target branch on initiative. When the user explicitly asks to merge, use the repository's established merge method unless they specify another one.

Before merging an ordinary or Post-Campaign Cleanup pull request, confirm required checks pass. For a campaign implementation pull request whose automatic CI is deliberately suspended, confirm the issue-campaign local-verification and lead-review gates instead. If branch protection blocks the requested merge, report the blocker rather than bypassing it.
