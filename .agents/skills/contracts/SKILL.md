---
name: contracts
description: Defines implementation self-acknowledgments for production types and functions. Use when implementing or reviewing maintained source, or selecting Evidence checklists.
---

# Implementation Contracts

Read [common.md](common.md) and only the scoped topic whose design decisions the declaration owns. Select types and functions; fields keep native documentation and are covered by their type. Include private helpers in the review of their owning operation.

An acknowledgment explains why the implementation approach is appropriate, the assumptions it relies on and any unresolved departure. It does not certify outputs, enumerate regression cases or claim tests passed. State an actual limitation rather than declaring compliance with a requirement the implementation does not meet.

Product behavior belongs to [project](../project/SKILL.md) and package documentation. [Development](../development/SKILL.md#testing) owns tests and [Evidence adoption](../development/SKILL.md#evidence-adoption) owns selection and validation. Evidence checks that answers exist; [review](../review/SKILL.md#review-law) checks their truth. Neither replaces behavioral verification.

Package and logical-unit requirements also inform the scoped questions below. Select a question when the operation makes that design decision, not for every declaration in its package. An acknowledgment justifies the decision; it does not repeat the product specification or certify its test cases.

Keep navigation between contract documents in this entry file. Sibling documents must not link to one another, so each checklist remains independently readable.

## [Common Implementation Principles](common.md)

Principled implementation and its justification, clear and simple design, prohibited shortcuts and useful documentation that follows the documentation skill.

## [OS-Neutral Implementation](portability.md)

Platform assumptions and supported abstractions at native filesystem and process boundaries.

## [Performance](performance.md)

Separate questions for algorithmic efficiency, required computation reuse and resource lifetime.
