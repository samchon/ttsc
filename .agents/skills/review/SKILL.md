---
name: review
description: Runs ttsc's Overall Self-Review of a complete change, which any unqualified review request means, and an issue campaign's per-commit Individual Self-Review. Use for every review or self-review.
---

# Review

## Review Law

- Read the whole declared surface yourself in the current checkout, without splitting it by file, package, concern, or agent, and follow it into consumers, tests, generated output, CI, and platforms.
- Reproduce a finding before accepting it.
- Collect a round's findings, fix them together, then run a fresh complete round. Stop only after a complete round finds nothing.
- For maintained code, check that each acknowledgment is true of its declaration under [contracts](../contracts/SKILL.md). A passing test or renamed wrapper does not prove a cause was fixed.

## Overall Self-Review

The review law over the whole change: the base-to-head diff and any uncommitted work. Report the clean round and every check that could not run. It grants no authority to push or merge.

## Individual Self-Review

In an issue campaign, the review of one pushed commit's diff. It never replaces Overall Self-Review.
