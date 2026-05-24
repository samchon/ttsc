# Agent B Knowledge

Scope: paths allowJs e2e.

Findings: the e2e should assert the target emitted files exist, not only that
imports were rewritten.

Proposal accepted: assert emitted `.js`, `.mjs`, `.cjs`, and `.jsx` files.
