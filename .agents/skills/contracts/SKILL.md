---
name: contracts
description: Defines the @evidence checklists every maintained ttsc declaration and test answers, and their evidence.config.json wiring. Use when writing or reviewing maintained source or tests, or changing Evidence selection.
---

# Contracts

Each checklist H2 is a question that every selected declaration answers in its doc comment. A package's `evidence.config.json` selects the checklists; `pnpm evidence` checks that answers exist, and review checks that they are true.

| Checklist | Asks about |
| --- | --- |
| [common.md](common.md) | Method, design, shortcuts, and documentation of production code |
| [portability.md](portability.md) | Native filesystem, path, and process boundaries |
| [performance.md](performance.md) | Computation cost, reuse, and resource lifetime |
| [testing.md](testing.md) | Behavior, expectations, and cases of every test |
| [e2e.md](e2e.md) | Boundaries, shared preparation, and isolation of E2E tests |

## Answering

- Write `@evidence contracts/<file>.md#<anchor> <reason>` for each selected H2 after a blank comment line, and `@evidenceExclude` the same way for a single item that does not apply, never a whole file.
- Say why the approach fits and what it assumes or leaves unresolved. Do not certify results; a test answer names the cases it owns.
- Fix a defect before answering it. Never pass the check with a generic answer, a narrower selector, or a lower severity.

## Selection

- From a package, `pnpm exec evidence list` and `pnpm exec evidence inspect '<target>'` show what a selector reaches.
- `Claims: 3/4 active` means a selector matched nothing, without a diagnostic, and `Coverage` counts checklist sections, not declarations.
- A Go package of unexported declarations, such as `packages/evidence/native`, selects no production host, so review covers it. A `declare module "@ttsc/lint"` augmentation reports `typescript-ambient-module` until the adapter resolves it.
- Exclude only generated, copied, or dependency material with verified provenance, and omit a pure re-export barrel whose targets span disjoint claims.
- Enroll tests in the existing Evidence step of `build.yml`, and record entries the adapter cannot address, such as anonymous callbacks or dynamic registrations, for review.

## Editing The Checklists

Tens of thousands of tags cite their paths and H2s, so adding, renaming, or removing an H2 needs an authorized migration of every answer. Keep one chapter per question and no links inside a checklist.
