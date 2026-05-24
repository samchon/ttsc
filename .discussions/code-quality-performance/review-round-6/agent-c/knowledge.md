# Agent C Knowledge

Scope: lint huge decimal precision handling and wasm API/host comments.

Findings:

- The 309-digit cutoff is derived from `Number.MAX_VALUE`, not a consumer
  hardcode.
- The predicate test alone did not cover parser/source-text/rule-engine
  plumbing.
- Go `APIResult` is not the whole JS `ITtscResult` envelope.

Proposals:

- Add public rule-engine coverage for the huge decimal literal.
- Reword wasm host comments to distinguish Go capture payloads from the JS
  result envelope.
