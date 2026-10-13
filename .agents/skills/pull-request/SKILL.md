---
name: pull-request
description: Branches, commits, pushes, opens, updates, and merges ttsc pull requests. Use only when the user asks for one of those actions or a mandate names delivery.
---

# Pull Request

Pushing, opening, and merging each need the user's request or a mandate that names them.

- Branch `<type>/<scope>` from `master` in the current checkout. Never commit to `master` or use another clone or worktree, and stage only your own paths.
- Commit as `<type>(<scope>): <imperative lowercase subject>`.
- Write the body once: intent, scope, deferred items, local verification, and skipped checks. Record later fixes and [Self-Review](../review/SKILL.md) rounds as `COMMENT` reviews, with line findings inline, never as ordinary comments, `APPROVE`, or `REQUEST_CHANGES`.
- Push a correction only after every check of the current head has settled, because a push cancels the running checks.
- Squash-merge once required checks are green on the exact head, plus a clean [Overall Self-Review](../review/SKILL.md#overall-self-review) on it for an [issue campaign](../issue-campaign/SKILL.md). Under a delivery mandate, merge without asking. `nestia.yml` is not a merge gate. Report a branch-protection block instead of bypassing it.
- Never bump versions, tag, or publish; releases belong to the maintainer.
