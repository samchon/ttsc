---
name: review
description: Defines exhaustive solo Overall Self-Review, mandatory advisory Individual Self-Review for solo issue-campaign commits, unqualified review, and solo repository-wide issue-discovery rounds for ttsc. Use for every self-review or unqualified review request and as the default review mode inside issue campaigns; use the multi-agent skill only when the user explicitly requests a team, parallel, or multi-agent review.
---

# Review

Individual Self-Review and Overall Self-Review are both Self-Review workflows. Individual review is a mandatory advisory pass over one pushed campaign commit, while Overall review is the solo whole-diff merge gate.

## Non-Negotiable Review Law

One reviewer performs every review in this skill from scratch over its entire declared surface. Do not spawn a subagent for an unqualified review, Overall Self-Review, or issue discovery, and do not delegate a concern or load the discussion skill. The mandatory Individual Self-Review defined below is the sole subagent carve-out. Do not create a clone or worktree for review.

Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every review decision. Review duration, difficulty, and consequence surface never lower the completion standard.

A complete round must satisfy all four rules:

- **Whole surface:** read every changed file and hunk. For issue discovery, audit the entire campaign scope. Never partition by file, package, concern, platform, or pass.
- **Consequence surface:** inspect affected code paths, tests, generated artifacts, CI, packaging, documentation, and consumers. Trace side effects, state transitions, concurrency, platforms, boundaries, compatibility, and failure and recovery paths beyond the named symptom or diff.
- **Fresh start:** use the current state and repeat the whole inspection. Earlier rounds, sampled files, and a recheck of only the latest fix do not count as coverage.
- **Unlimited rounds:** whenever the reviewer applies an improvement or accepts a meaningful issue candidate, update the work and start another complete round. Stop only after a complete round produces nothing that survives verification.

## Overall Self-Review

Overall Self-Review uses this solo workflow. Outside a solo issue campaign, an unqualified Self-Review request means Overall Self-Review.

1. Establish the complete change surface, including the pull-request base-to-head diff and any uncommitted changes.
2. Perform one complete round under the Non-Negotiable Review Law. Include correctness and boundaries, Windows and POSIX behavior, concurrency and state, data loss and security, cache and recovery invariants, public API and compatibility, test isolation, CI and packaging, generated output, documentation, and migration effects.
3. Reproduce every suspected defect before accepting it.
4. Apply every sound improvement and run the narrowest verification authorized by the owning workflow.
5. If anything changed, restart at step 1 as a fresh full round.
6. Finish only when a complete round finds nothing to improve. Report the final clean round and every verification that could not run.

Overall Self-Review does not authorize creating, pushing, updating, or merging a pull request. If the user separately requests one of those actions, follow the pull-request skill.

## Individual Self-Review

Individual Self-Review is the mandatory read-only review of exactly one coherent pushed issue-implementation commit in a solo issue campaign. The [solo campaign development document](../issue-campaign/development.md#implement-and-write-tests) defines its timing and pull-request record.

The main agent immediately starts exactly one review subagent for that commit and continues implementing the next ready issue without waiting for the result or per-commit CI. The reviewer reads only the parent-to-commit change, reports advice and candidate findings to the main agent, and never edits, commits, pushes, comments on GitHub, or makes implementation decisions.

When the result arrives, the main agent adjudicates every candidate and records the Individual Self-Review result as a formal GitHub pull-request review with the `COMMENT` event. Put line-specific observations in inline review comments and commit-wide results in the review body.

Individual Self-Review never reduces or substitutes for Overall Self-Review. The main agent still performs a fresh, exhaustive, solo Overall Self-Review of the complete pull-request base-to-head diff before merge, and only that clean Overall Self-Review is the review gate. Individual reviews do not combine into an Overall Self-Review round.

## Solo Issue Discovery Rounds

Use these rounds only through the solo issue-campaign skill.

1. Audit the entire declared campaign scope yourself. Inspect source, tests, documentation, CI, packaging, generated artifacts, platform behavior, upstream or downstream provenance, and open and closed issue or pull-request history. Audit the current implementation and history against the development skill's **Forbidden** section.
2. Record every raw candidate and its evidence in the campaign knowledge base before adjudication. Do not silently discard a suspicion because it looks duplicative or inconvenient.
3. Reopen each candidate from primary evidence, reproduce it, verify ownership and provenance, and trace its complete consequence surface.
4. Record accept, partial acceptance, rewrite, combine, split, reject, or defer. Keep the disposition and reason in the knowledge base so later passes do not rediscover a rejected premise as new.
5. Publish only the surviving adjudicated form when the campaign is authorized to publish.
6. If any meaningful candidate survives, complete its authorized adjudication and publication, keep implementation closed, and begin another complete fresh full-scope round against the same recorded pre-development integrated state.
7. Repeat step 6 without a round limit. Candidate rechecks, sampled areas, and the completed work from earlier rounds do not count toward the next round.
8. End the cycle's discovery phase only when one complete fresh round over the entire scope produces no meaningful candidate after fact-checking. Hand every implementation-ready accepted issue accumulated across the preceding nonempty rounds to the cycle's unified development pull request.
9. After that pull request merges, start the next cycle's discovery saturation from the new integrated state. End the campaign only when an empty round leaves no accepted campaign issue unresolved.

An empty round can open development while accepted issues remain, but an unresolved accepted issue, external blocker, or incomplete implementation prevents a successful campaign conclusion. Report the campaign as blocked or active rather than complete.

## Explicit Multi-Agent Reviews

When the user explicitly asks for a team, parallel, or multi-agent review, load the [multi-agent skill](../multi-agent/SKILL.md) and its [review procedure](../multi-agent/review.md) instead of this workflow. It inherits the same whole-surface and fresh-round law while defining independent parallel reviewers and lead adjudication.
