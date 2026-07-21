---
name: review
description: Defines exhaustive solo review, Self-Review, and solo repository-wide issue-discovery rounds for ttsc. Use for every self-review or unqualified review request and as the default review mode inside issue campaigns. This skill never spawns review agents; use the multi-agent skill only when the user explicitly requests a team, parallel, or multi-agent review.
---

# Review

## Non-Negotiable Review Law

One reviewer performs every review in this skill from scratch over the entire declared surface. Do not spawn a subagent, delegate a concern, or load the discussion skill. Do not create a clone or worktree for solo review or Self-Review.

Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every review decision. Review duration, difficulty, and consequence surface never lower the completion standard.

A complete round must satisfy all four rules:

- **Whole surface:** read every changed file and hunk. For issue discovery, audit the entire campaign scope. Never partition by file, package, concern, platform, or pass.
- **Consequence surface:** inspect affected code paths, tests, generated artifacts, CI, packaging, documentation, and consumers. Trace side effects, state transitions, concurrency, platforms, boundaries, compatibility, and failure and recovery paths beyond the named symptom or diff.
- **Fresh start:** use the current state and repeat the whole inspection. Earlier rounds, sampled files, and a recheck of only the latest fix do not count as coverage.
- **Unlimited rounds:** whenever the reviewer applies an improvement or accepts a meaningful issue candidate, update the work and start another complete round. Stop only after a complete round produces nothing that survives verification.

## Self-Review

Self-Review and an unqualified review request use this solo workflow:

1. Establish the complete change surface, including the pull-request base-to-head diff and any uncommitted changes.
2. Perform one complete round under the Non-Negotiable Review Law. Include correctness and boundaries, Windows and POSIX behavior, concurrency and state, data loss and security, cache and recovery invariants, public API and compatibility, test isolation, CI and packaging, generated output, documentation, and migration effects.
3. Reproduce every suspected defect before accepting it.
4. Apply every sound improvement and run the narrowest verification authorized by the owning workflow.
5. If anything changed, restart at step 1 as a fresh full round.
6. Finish only when a complete round finds nothing to improve. Report the final clean round and every verification that could not run.

Self-Review does not authorize creating, pushing, updating, or merging a pull request. If the user separately requests one of those actions, follow the pull-request skill.

## Early Warning Is Not Self-Review

A per-commit early-warning pass is a different activity under a different name, not a review under this skill. One subagent reads a commit as it lands and reports candidates while the author keeps implementing. It reads and reports only: it never edits, commits, pushes, or settles a design question, and its report is evidence the author still has to reproduce. [Solo campaign development](../issue-campaign/development.md#implement-and-write-tests) authorizes and bounds that cadence.

Because the pass decides nothing, it delegates nothing the Non-Negotiable Review Law governs. The law's prohibition on spawning a subagent and delegating a concern keeps its exact meaning, and all four rules still bind the author's own round unchanged. No number of per-commit passes counts toward whole-surface coverage or stands in for the complete round over the base-to-head diff before merge.

Never call the early-warning pass a Self-Review. A reader who sees the gate's name concludes the gate already ran, and the whole-surface round then disappears without anyone deciding to drop it, which is the failure the fresh-start rule exists to prevent.

A commit-sized reader also cannot see what appears only across files and commits: a document or issue asserting a verification the code never performs, a helper reimplemented next to one that already lives in the same package, a string match that can never fire because of how the target file is stored. Each one is consistent inside the commit that introduced it and becomes visible only over the whole diff.

## Solo Issue Discovery Rounds

Use these rounds only through the solo issue-campaign skill.

1. Audit the entire declared campaign scope yourself. Inspect source, tests, documentation, CI, packaging, generated artifacts, platform behavior, upstream or downstream provenance, and open and closed issue or pull-request history. Audit the current implementation and history against the development skill's **Forbidden** section.
2. Record every raw candidate and its evidence in the campaign knowledge base before adjudication. Do not silently discard a suspicion because it looks duplicative or inconvenient.
3. Reopen each candidate from primary evidence, reproduce it, verify ownership and provenance, and trace its complete consequence surface.
4. Record accept, partial acceptance, rewrite, combine, split, reject, or defer. Keep the disposition and reason in the knowledge base so later passes do not rediscover a rejected premise as new.
5. Publish only the surviving adjudicated form when the campaign is authorized to publish.
6. If any meaningful candidate survives, finish the authorized issue and implementation flow, then begin another fresh full-scope round over the integrated state.
7. End discovery only when one complete fresh round over the entire scope produces no meaningful candidate after fact-checking.

An unresolved accepted issue, external blocker, or incomplete implementation prevents a successful campaign conclusion. Report it as blocked or active rather than treating it as a clean round.

## Explicit Multi-Agent Reviews

When the user explicitly asks for a team, parallel, or multi-agent review, load the [multi-agent skill](../multi-agent/SKILL.md) and its [review procedure](../multi-agent/review.md) instead of this workflow. It inherits the same whole-surface and fresh-round law while defining independent parallel reviewers and lead adjudication.
