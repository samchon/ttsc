---
name: issue-campaign
description: Runs ttsc's issue campaign, repeating full discovery rounds until one finds nothing new, publishing the issues, and landing them in one pull request per cycle. Use for a broad audit or repeated issue-to-pull-request work, not for one defined issue.
---

# Issue Campaign

A cycle audits the target branch until a discovery round finds nothing new, then lands every accepted issue in one pull request whose merge starts the next cycle. Stay within the phases the user authorized; an audit-only request publishes and pushes nothing. Discover and fix only within the campaign's named topic, and say so at once if the work must reach beyond it.

## Discovery

1. Run a complete round under the [review law](../review/SKILL.md) over the declared scope, including real workflows, related issues and pull requests, and the [contracts](../contracts/SKILL.md) even where tests pass.
2. Check each candidate's owner, history, and duplicates, then accept, merge, split, or reject it.
3. Repeat complete rounds on the same baseline until one finds nothing meaningful. That freezes the accepted set; a target-branch change restarts discovery.

## Issues

With publication authority, write each accepted issue so a fresh agent can start from it alone: the problem, reproduction and root cause, consequence surface and case matrix, the invariant to restore, acceptance cases with commands, and dependencies.

## Pull Request

1. Branch from the baseline, push an empty commit (`git commit --allow-empty`), and open one draft pull request listing every cycle issue, with no closing keywords.
2. Implement every issue in dependency order with its tests. Drop an issue only as a duplicate, invalid, out of scope, or externally blocked, and say so on the issue.
3. End each resolving commit with `Close #n: <title>` per issue. A revert must drop that line, and a squash still carries the reverted commit's line.
4. After each pushed commit, run Individual Self-Review and record it as a `COMMENT` review.
5. On the integrated head, run Overall Self-Review while CI runs. Fix every failed check, pre-existing ones included, and repeat on the new head.
6. Format, then merge with authority once one head is green and review-clean. First read `git log origin/master..HEAD` to confirm each closed issue keeps its fix, and reopen any that does not.
7. After merge, `git pull --ff-only` on `master`, delete the topic branch, remove only the temporary paths the campaign created, and start the next cycle.

The campaign is complete when a round on the latest baseline finds nothing, no accepted issue is open, and no campaign branch, pull request, or temporary asset remains.
