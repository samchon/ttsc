---
name: review
description: Defines ttsc's review law and its two uses, Overall Self-Review (the whole-diff merge gate, and the meaning of any unqualified review request) and Individual Self-Review (the per-commit review in an issue campaign). Use for every self-review or unqualified review request.
---

# Review

## Review Law

Each review starts from scratch over its entire declared surface and runs in the current checkout, without a clone or worktree. Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude): review duration, difficulty, and consequence surface never lower the completion standard. The [issue-campaign skill's discovery rounds](../issue-campaign/SKILL.md#discovery-rounds) follow the same law.

A complete round satisfies all four rules:

- **Whole surface:** read every changed file and hunk. Never partition a round by file, package, concern, platform, or pass.
- **Consequence surface:** inspect affected code paths, tests, generated artifacts, CI, packaging, documentation, and consumers. Trace side effects, state transitions, concurrency, platforms, boundaries, compatibility, and failure and recovery paths beyond the named symptom or diff.
- **Fresh start:** inspect the current state and repeat the whole inspection. Earlier rounds, sampled files, and a recheck of only the latest fix do not count as coverage.
- **Unlimited rounds, one repair pass each:** a round inspects the whole surface before anything is repaired, and its findings are corrected together under [AGENTS.md's **Collect every symptom before correcting** rule](../../../AGENTS.md#attitude). A round that applied anything is followed by another complete round without limit; the loop ends only after a complete round produces nothing that survives verification.

## Overall Self-Review

Overall Self-Review is the review of a complete change. Outside an issue campaign, an unqualified review or Self-Review request means Overall Self-Review.

1. Establish the complete change surface, including the pull-request base-to-head diff and any uncommitted changes.
2. Perform one complete round under the [review law](#review-law). Include correctness and boundaries, Windows and POSIX behavior, concurrency and state, data loss and security, cache and recovery invariants, public API and compatibility, test isolation, CI and packaging, generated output, documentation, and migration effects.
3. Reproduce every suspected defect before accepting it.
4. Apply every sound improvement the round produced, together, and run the narrowest verification the owning workflow authorizes.
5. If anything changed, restart at step 1 as a fresh complete round.
6. Finish only when a complete round finds nothing to improve. Report the final clean round and every verification that could not run.

Overall Self-Review does not authorize creating, pushing, updating, or merging a pull request; those follow the pull-request skill when the user requests them.

## Individual Self-Review

Individual Self-Review is the review of exactly one pushed issue-implementation commit in an issue campaign. It reads only that commit's parent-to-commit diff, verifies every candidate finding, and carries what survives into a later commit. The campaign's [development procedure](../issue-campaign/development.md#implement-and-write-tests) owns when it runs and how its result is recorded.

Individual Self-Review never reduces or replaces Overall Self-Review. One commit cannot expose cross-file or integrated consequences, and individual reviews never combine into an Overall round; only a clean Overall Self-Review of the complete pull-request diff is the review gate.
