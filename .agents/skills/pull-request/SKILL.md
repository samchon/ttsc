---
name: pull-request
description: Defines ttsc's branch, commit, pull-request, check, and merge flow. Use only when the user explicitly asks to open, update, or merge a pull request, or a standing autonomous mandate covers delivery; never open, push, update, or merge one on unprompted initiative.
---

# Pull Request Submission

Act on this skill only when the user explicitly requests the remote action or a standing autonomous mandate covers it. Permission to edit locally is not permission to push or open a pull request, and permission to open or update is not permission to merge. A standing autonomous mandate, such as an autonomous or remote-control campaign or an explicit instruction to carry the work through merge, requests every step it names, including push and merge. The check, verification, and Self-Review gates still apply to each step, and the work runs under [AGENTS.md's **Unattended runs** rule](../../../AGENTS.md#attitude).

## Branch From The Target

Branch from the pull-request target (`master` unless stated otherwise); never commit or push directly to the target. Name the branch for the merged outcome with the repository's established type and scope, such as `feat/<scope>`, `fix/<scope>`, `docs/<scope>`, or `ci/<scope>`.

Never create a clone or worktree. If the current checkout contains unrelated or protected work, stage only the authorized paths; if that cannot keep the pull request isolated, report the conflict rather than stashing, reverting, mixing, or relocating the work.

## Commit Logical Units

Use one commit per coherent unit when the diff is large. Follow the repository's `<type>(<scope>): <subject>` history with an imperative lowercase subject and no trailing period.

Run the validation and the `pnpm format` step the development skill requires, including its issue-campaign exception.

Stage explicit paths when the worktree is mixed. Never include unrelated user changes silently.

## Write The Pull Request

Write the body at open as the historical intent statement. Include the intent, scope, deferred items, and exact local verification. State skipped checks honestly.

Do not rewrite the body after every follow-up push. Record later CI fixes, newly discovered design issues, promoted deferred work, Individual Self-Review results, and Overall Self-Review rounds as formal GitHub pull-request reviews with the `COMMENT` event so the thread preserves chronology. Use inline review comments when an observation belongs to a changed line and the review body for commit-wide or round-wide results. Do not use ordinary issue-style pull-request comments for this ledger, and never `APPROVE` or `REQUEST_CHANGES` on your own pull request. The title describes the merged outcome in Conventional Commits style, not the work process.

Push only the topic branch with upstream tracking. Use a file-backed body for multiline Markdown when opening through `gh`.

## Issue Campaigns

An issue campaign pushes and opens its cycle pull request only through [its development procedure](../issue-campaign/development.md), which owns the claim, the formatting points, the check loop, and the review record.

## Read Checks

Checks run under [AGENTS.md's **Background work never stops the turn** rule](../../../AGENTS.md#attitude), which sets what to do while they run and how a failed check is read. Do not treat a green unrelated check as acceptance for a failed required surface.

Push a correction only after every check of the current head has settled, so the one correction [AGENTS.md's **Collect every symptom before correcting** rule](../../../AGENTS.md#attitude) requires covers every failure the head produced. Every pull-request workflow sets `cancel-in-progress`, so a push cancels the checks the previous head still has running and discards the failures they would have reported.

An issue campaign reads checks this way on its integrated head, not on each implementation commit, as [its development procedure](../issue-campaign/development.md#validate-with-ci-and-overall-self-review) requires.

## Merge On Explicit Request Or Standing Autonomous Mandate

Do not merge, squash-merge, rebase, or update the target branch on unprompted initiative. Merge when the user explicitly asks, or when a standing autonomous mandate authorizes end-to-end delivery; use the repository's established merge method unless another is specified. Under an autonomous mandate the author that owns the pull request merges it themselves once the merge gate below passes, without separate approval.

Before merging, confirm the required checks pass on the exact head being merged. A campaign implementation pull request also needs its complete clean Overall Self-Review round on that same head. If branch protection blocks the requested merge, report the blocker rather than bypassing it.
