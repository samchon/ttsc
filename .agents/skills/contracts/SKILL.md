---
name: contracts
description: Defines implementation self-acknowledgments for production types and functions. Use when implementing or reviewing maintained source, or selecting Evidence checklists.
---

# Implementation Contracts

Read [common.md](common.md) and only the scoped topic whose design decisions the declaration owns. Select scoped questions by the operation's responsibility, not membership in a package.

Select types and functions; fields keep native documentation and are covered by their type. Include private helpers in the review of their owning operation so delegation does not hide an implementation decision.

An acknowledgment explains why the implementation approach is appropriate, the assumptions it relies on and any unresolved departure. It does not certify outputs, enumerate regression cases or claim tests passed. State an actual limitation rather than declaring compliance with a requirement the implementation does not meet.

Meet all applicable requirements together. No chapter permits weakening the supported behavior to satisfy another.

Benchmarks, test runs and formal proofs are not universal acknowledgment requirements. The answer supplies grounds for review, not a verification report.

Product behavior belongs to [project](../project/SKILL.md) and package documentation. [Development](../development/SKILL.md#testing) owns tests and [Evidence adoption](../development/SKILL.md#evidence-adoption) owns selection and validation. Evidence checks that answers exist; [review](../review/SKILL.md#review-law) checks their truth. Neither replaces behavioral verification.

Keep document links in this entry file. Checklist documents must contain no links, so each checklist remains independently readable.

Apply the [documentation skill](../documentation/SKILL.md) when writing contract prose and related repository documentation.

Give each requirement one chapter owner. A declaration may answer several chapters about the same implementation, but each answer must address its own question without requesting the other answers again. Maintain these boundaries when revising the checklists:

| Chapter | Question owned |
| --- | --- |
| Principled Implementation | Why does the method or value representation establish the required meaning under its stated premises? |
| Clear and Simple Design | Why are the responsibilities and structural elements clear and necessary for current requirements? |
| Prohibited Implementation Shortcuts | Does the implementation rely on a forbidden substitution or a compensation for a disproven assumption? |
| Meaningful documentation | What useful information is written for users and maintainers, and does that writing follow the documentation guidance? |
| OS-neutral implementation | How are native platform differences represented at the filesystem or process boundary? |
| Efficient algorithms | What does one necessary computation cost as its input grows? |
| Reuse equivalent work | Which requests can share a computation, and what establishes continued validity of its result? |
| Bound retention and release resources | Who owns retained state and handles, how does their population grow, and when are they released? |

## [Common Implementation Principles](common.md)

Principled implementation and its justification, clear and simple design, prohibited shortcuts and useful documentation that follows the documentation skill.

## [OS-Neutral Implementation](portability.md)

Platform assumptions and supported abstractions at native filesystem and process boundaries.

## [Performance](performance.md)

Separate questions for algorithmic efficiency, required computation reuse and resource lifetime.
