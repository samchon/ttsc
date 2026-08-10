---
name: multi-agent
description: "Defines the explicitly parallel variants of ttsc review and issue campaigns. Use only when the user explicitly requests a team, parallel, or multi-agent review or campaign. Route review work to review.md and issue campaigns to issue-campaign.md. Overall Self-Review and unqualified review remain solo; the solo campaign's mandatory Individual Self-Review is a separate narrow subagent workflow. A multi-agent issue campaign differs from the solo campaign only in parallel batch implementation inside its one shared checkout, branch, and cycle pull request."
---

# Multi-Agent Workflows

This skill is the single entry point for every explicitly parallel review or campaign. Read the base solo skill first, then enter through the detailed document below for the requested workflow. That document names any shared multi-agent topic procedures it also requires.

| Explicit request | Base skill | Detailed multi-agent procedure |
| --- | --- | --- |
| Team, parallel, or multi-agent review | [review](../review/SKILL.md) | [review.md](review.md) |
| Parallel or multi-agent issue campaign | [issue-campaign](../issue-campaign/SKILL.md) | [issue-campaign.md](issue-campaign.md) |

`ttsc` has no benchmark-campaign skill. Use [benchmark](../benchmark/SKILL.md) for measurement integrity, then the applicable issue-campaign workflow for authorized benchmark-driven implementation.

Do not load this skill merely for Individual Self-Review, Overall Self-Review, an unqualified review, or a campaign that does not explicitly request parallel agents.

## Shared Parallelism Rules

- Use the smallest number of agents that adds independent evidence or owns immediately executable disjoint work. Available thread capacity is not a reason to create an agent.
- Never create a waiter, poller, coordinator-only child, duplicate implementation owner, or agent that cannot begin useful work immediately.
- Give every review or discovery agent the complete declared surface. Parallel review adds independent full passes; it never partitions coverage by package, file, concern, platform, or test lane.
- Partition implementation only through verified dependency and file-ownership boundaries. One agent owns one coarse batch and its disjoint file set inside the campaign's single shared checkout, topic branch, and cycle pull request.
- Keep the lead active on fact-checking, integration, conflict resolution, and decisions that do not duplicate an assigned agent.
- Do not let agents re-delegate.
- Overall Self-Review remains solo. In a parallel campaign the lead alone runs it, over the integrated pull-request diff.
- Never create a clone or worktree. Every workflow in this skill, parallel implementation included, runs in the current checkout.
- Remove every finished local branch, process, and assignment-owned temporary asset before declaring its assignment complete.

The solo campaign's [Individual Self-Review](../review/SKILL.md#individual-self-review) is a different topology and relaxes neither the full-surface rule nor the solo Overall Self-Review rule above.

A parallel review gives several reviewers the entire declared surface independently, and the lead adjudicates their findings. Individual Self-Review gives exactly one read-only reviewer one pushed commit's parent-to-commit diff, returns advice to the main agent while implementation continues, and leaves that main agent's whole-surface Overall Self-Review as the merge gate.

A batch implementation agent spawns no Individual Self-Review because agents do not re-delegate. It reviews its own pushed batch through [Batch Self-Review](issue-campaign.md#batch-self-review), and the solo development procedure's subagent carve-out stays with a solo campaign's main agent.
