---
name: pull-request
description: Defines ttsc branch, commit, pull-request, check, and merge workflows. Use when the user explicitly asks to open, submit, update, or merge a pull request, or when a standing autonomous mandate authorizes end-to-end delivery; never open, push, update, or merge one on unprompted initiative.
---

# Pull Request Submission

Act on this skill only when the user explicitly requests the corresponding remote action, or when a standing autonomous mandate authorizes it. Permission to edit locally is not permission to push or open a pull request, and permission to open or update is not permission to merge. The one exception is a standing autonomous mandate, such as an autonomous or remote-control campaign or an explicit instruction to carry the work through merge. It requests every step it names, including push and merge, and the skill's check, verification, and Self-Review gates still apply to each step.

## Branch From The Target

Branch from the pull-request target (`master` unless stated otherwise); never commit or push directly to the target. Name the branch for the merged outcome with the repository's established type and scope, such as `feat/<scope>`, `fix/<scope>`, `docs/<scope>`, or `ci/<scope>`.

Solo work never creates a clone or worktree. If the current checkout contains unrelated or protected work, stage only the authorized paths; if that cannot keep the pull request isolated, report the conflict rather than stashing, reverting, mixing, or relocating the work.

## Commit Logical Units

Use one commit per coherent unit when the diff is large. Follow the repository's `<type>(<scope>): <subject>` history with an imperative lowercase subject and no trailing period.

Run the validation required by the development skill. Run `pnpm format` before ordinary commits. An issue campaign formats its unified implementation branch once, and in a multi-agent campaign that formatter run belongs to the lead's finishing phase.

Stage explicit paths when the worktree is mixed. Never include unrelated user changes silently.

## Write The Pull Request

Write the body at open as the historical intent statement. Include the intent, scope, deferred items, and exact local verification. State skipped checks and disabled campaign CI honestly.

Do not rewrite the body after every follow-up push. Record later CI fixes, newly discovered design issues, promoted deferred work, Individual Self-Review results, and Overall Self-Review rounds as formal GitHub pull-request reviews with the `COMMENT` event so the thread preserves chronology. Use inline review comments when an observation belongs to a changed line and the review body for commit-wide or round-wide results. Do not use ordinary issue-style pull-request comments for this ledger, and never `APPROVE` or `REQUEST_CHANGES` on your own pull request. The title describes the merged outcome in Conventional Commits style, not the work process.

Push only the topic branch with upstream tracking. Use a file-backed body for multiline Markdown when opening through `gh`.

## Issue Campaign Override

Before any issue-campaign push or pull request, complete `.agents/skills/issue-campaign/development.md`. Every campaign uses one formatted pull request and the ordinary check loop. The explicit multi-agent procedure overrides only the topology: parallel batch agents share that one checkout, topic branch, and pull request, and each records its own Batch Self-Review there.

## Watch Checks After Every Ordinary Push

After each ordinary push, monitor the pull-request checks until every check settles. On failure, fetch the relevant job log, diagnose the real cause, fix it in place, push a new commit, and resume monitoring. Do not treat a green unrelated job as acceptance for a failed required surface.

Issue-campaign implementation commits skip that per-push wait. The solo main agent starts the required Individual Self-Review and immediately implements the next ready issue, while a multi-agent batch agent continues its batch and leaves every check to the lead. Both read CI once the integrated head settles, as the development procedure requires.

## Merge On Explicit Request Or Standing Autonomous Mandate

Do not merge, squash-merge, rebase, or update the target branch on unprompted initiative. Merge when the user explicitly asks, or when a standing autonomous mandate authorizes end-to-end delivery; use the repository's established merge method unless another is specified. Under an autonomous mandate the author that owns the pull request merges it themselves once the merge gate below passes, without separate approval.

Before merging, confirm the required checks pass on the exact head being merged. A campaign implementation pull request also needs its complete clean Overall Self-Review round on that same head. If branch protection blocks the requested merge, report the blocker rather than bypassing it.
