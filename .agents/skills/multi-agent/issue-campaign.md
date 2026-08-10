# Multi-Agent Issue Campaign

A multi-agent issue campaign is the [solo issue campaign](../issue-campaign/SKILL.md) with one difference: implementation runs as parallel batches. Discovery, publication, and the entire [development procedure](../issue-campaign/development.md) stay exactly as written there.

Read this document only through the multi-agent skill for an explicitly parallel issue campaign.

The batches share the campaign's one checkout, topic branch, and cycle pull request. Nothing here adds a worktree, a per-batch branch, or a second pull request.

## Parallel Batches

Once the lead has claimed the cycle pull request, group the accepted issues by kind, cut the groups along the published-issue DAG, and hand one agent the largest cohesive batch it can own alone. Issue count never sets agent count, and concurrent batches must stay on disjoint file sets.

Each agent implements its issues with their tests, commits and pushes them to the shared branch, runs [Batch Self-Review](#batch-self-review), and reports. It builds, tests, and formats nothing locally, and it disregards CI entirely. Every check run belongs to the lead's finishing phase.

### Batch Self-Review

Batch Self-Review replaces Individual Self-Review for a batch agent's commits, and the agent runs it itself because agents do not re-delegate.

It is [Overall Self-Review](../review/SKILL.md#overall-self-review) over one surface, the agent's own pushed commits.

The lead's Overall Self-Review still gates the merge.

## Finishing Phase

Once every agent has reported, rejoin the solo procedure at its formatted integrated snapshot. Start the lead's Overall Self-Review rounds at once instead of waiting for CI, and carry the cycle through CI repair and merge.
