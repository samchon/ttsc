# Agent C Knowledge

Scope: lint and wasm final review.

Findings:

- Huge-decimal lint behavior now has predicate and public engine coverage.
- The `APIResult` comment still implied direct JS plugin return shape.

Proposal: tighten the `APIResult` comment to describe the internal capture
payload before js/wasm wrapping.
