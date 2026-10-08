---
name: contracts
description: Defines self-acknowledgments for production declarations and tests. Use when implementing or reviewing maintained source, unit tests or E2E tests, or selecting Evidence checklists.
---

# Implementation Contracts

For production declarations, read [common.md](common.md) and only the scoped topic whose design decisions the declaration owns. Select scoped questions by the operation's responsibility, not membership in a package. For every test, read [testing.md](testing.md); for E2E tests, also read [e2e.md](e2e.md). Apply production contracts to maintained helpers when their implementation owns those decisions.

Select types and functions; fields keep native documentation and are covered by their type. Include private helpers in the review of their owning operation so delegation does not hide an implementation decision.

An acknowledgment explains why the approach is appropriate, the assumptions it relies on and any unresolved departure. Production acknowledgments do not enumerate regression cases; test acknowledgments identify the cases and assertions they own. Neither certifies outputs or claims tests passed. State an actual limitation rather than declaring compliance with a requirement the implementation does not meet.

Meet all applicable requirements together. No chapter permits weakening the supported behavior to satisfy another.

Benchmarks, test runs and formal proofs are not universal acknowledgment requirements. The answer supplies grounds for review, not a verification report.

Product behavior belongs to [project](../project/SKILL.md) and package documentation. [Development](../development/testing.md) owns test procedures and [Evidence adoption](../development/evidence.md) owns selection and validation. Evidence checks that answers exist; [review](../review/SKILL.md#review-law) checks their truth. Neither replaces behavioral verification.

Keep document links in this entry file. Checklist documents must contain no links, so each checklist remains independently readable.

Apply the [documentation skill](../documentation/SKILL.md) when writing contract prose and related repository documentation.

Give each question one chapter owner across the checklist files, and extend the owning chapter instead of adding a second one. A declaration may answer several chapters about the same implementation, but each answer addresses its own question and does not request another chapter's answer again.

## [Common Implementation Principles](common.md)

Principled implementation and its justification, clear and simple design, prohibited shortcuts and useful documentation that follows the documentation skill.

## [OS-Neutral Implementation](portability.md)

Platform assumptions and supported abstractions at native filesystem and process boundaries.

## [Performance](performance.md)

Separate questions for algorithmic efficiency, required computation reuse and resource lifetime.

## [Testing](testing.md)

Behavioral assertions, independent expectations, distinguishing cases and execution ownership for every test.

## [E2E](e2e.md)

Necessary real boundaries, shared preparation, valid isolation and preserved assertions when consolidating E2E cases.
