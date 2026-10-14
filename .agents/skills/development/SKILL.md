---
name: development
description: Repairs, implements, tests, and validates ttsc source, tests, fixtures, workflows, and package wiring. Use before editing any of them; acknowledgments belong to contracts and the typescript-go shim to typescript-go-sync.
---

# Development

## Contracts

Every maintained declaration answers, in its doc comment, the [contracts](../contracts/SKILL.md) checklists its package selects:

- production types and functions: [`common.md`](../contracts/common.md), plus [`portability.md`](../contracts/portability.md) and [`performance.md`](../contracts/performance.md) where selected;
- tests: [`testing.md`](../contracts/testing.md), and E2E tests also [`e2e.md`](../contracts/e2e.md).

## Code

- Plugin descriptors are JS and transform logic is Go; JS transform functions are not public contract.
- First-party plugin options live in a `*.config.*` file found by an upward walk from the entry. Shipped packages accept only `configFile` beyond host entry keys.
- In `packages/ttsc/src`, a file exports one symbol named after it, right after the imports; helpers of one concern become one namespace.
- `@ttsc/graph`'s MCP instruction keeps its first 512 characters saying what the tool is, when to use it, and why its facts hold. Measure any change to its logic, instruction, or schema through the [graph benchmark](../benchmark/graph.md).
- `@ttsc/evidence` semantics live in the website's Evidence guides and its invariants in the tests of `packages/evidence/native`; change both together. Never make a graph pass by excluding, retargeting, or deleting an author's citation, and never add a rule that judges whether a reason is sincere.
- Update the matching guide under `website/src/content/docs/` in the same change.
- Tests, fixtures, CI, wiring, dependencies, and generated baselines are specification. Change them only on request or for a product reason, and say so.

## Task Guides

- Read [Repair](repair.md) when changing existing behavior.
- Read [Testing](testing.md) when adding or changing tests.
- Read [Validation](validation.md) before running checks or preparing a change for CI.
