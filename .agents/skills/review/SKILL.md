---
name: review
description: Runs ttsc's Overall Self-Review of a complete change, which any unqualified review request means, and an issue campaign's per-commit Individual Self-Review. Use for every review or self-review.
---

# Review

## Review Law

- Read the whole declared surface in the current checkout, without splitting it by file, package, or concern, and follow it into consumers, tests, generated output, CI, and platforms.
- Collect a round's findings, fix them together, then run a fresh complete round. Stop only after a complete round finds nothing.
- For maintained code, check that each acknowledgment is true and complete for its declaration under [contracts](../contracts/SKILL.md). A passing test or renamed wrapper does not prove a cause was fixed.

## Overall Self-Review

The review law over the whole change: the base-to-head diff and any uncommitted work. Report the clean round, every check that could not run, and every claim fixed in code but not yet proven on a real host. It grants no authority to push or merge.

## Individual Self-Review

In an [issue campaign](../issue-campaign/SKILL.md), the review of one pushed commit's diff. It never replaces Overall Self-Review.
