---
name: multi-agent
description: "Defines the explicitly parallel variants of ttsc review and issue campaigns. Use only when the user explicitly requests a team, parallel, or multi-agent review or campaign. Route review work to review.md and issue campaigns to issue-campaign.md. Self-Review and unqualified review remain solo. Multi-agent issue campaigns parallelize discovery and implementation by default, but an explicit request may limit parallelism to discovery and return implementation to the solo campaign."
---

# Multi-Agent Workflows

This skill is the single entry point for every explicitly parallel review or campaign. Read the base solo skill first, then enter through the detailed document below for the requested workflow. That document names any shared multi-agent topic procedures it also requires.

| Explicit request | Base skill | Detailed multi-agent procedure |
| --- | --- | --- |
| Team, parallel, or multi-agent review | [review](../review/SKILL.md) | [review.md](review.md) |
| Parallel or multi-agent issue campaign | [issue-campaign](../issue-campaign/SKILL.md) | [issue-campaign.md](issue-campaign.md) |

`ttsc` has no benchmark-campaign skill. Use [benchmark](../benchmark/SKILL.md) for measurement integrity, then the applicable issue-campaign workflow for authorized benchmark-driven implementation.

Do not load this skill for Self-Review, an unqualified review, or a campaign that does not explicitly request parallel agents.

A solo campaign's per-commit early-warning pass is not this topology and does not enter here. Parallel review gives several reviewers the same whole declared surface for independent passes that the lead adjudicates. The early-warning pass gives one reader one commit's slice to report on while the author keeps implementing, and the author's own whole-surface round before merge is still the gate. Its cadence lives in [solo campaign development](../issue-campaign/development.md#implement-and-write-tests) and its naming rule in the [review skill](../review/SKILL.md#early-warning-is-not-self-review).

## Shared Parallelism Rules

- Use the smallest number of agents that adds independent evidence or owns immediately executable disjoint work. Available thread capacity is not a reason to create an agent.
- Never create a waiter, poller, coordinator-only child, duplicate implementation owner, or agent that cannot begin useful work immediately.
- Give every review or discovery agent the complete declared surface. Parallel review adds independent full passes; it never partitions coverage by package, file, concern, platform, or test lane.
- Partition implementation only through verified dependency and file-ownership boundaries. One agent owns one coarse batch, branch, pull request, and worktree.
- Keep the lead active on fact-checking, integration, conflict resolution, and decisions that do not duplicate an assigned agent.
- Do not let agents re-delegate.
- Self-Review remains solo for every author and every implementation branch.
- Create worktrees only for parallel implementation batches and their integrated cleanup. Solo implementation and review use the current checkout.
- Remove every finished worktree, local branch, process, and assignment-owned temporary asset before declaring its assignment complete.
