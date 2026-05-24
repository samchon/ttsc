# Review Round 6 Proposals

## Accepted

- Replace the paths allowJs e2e `@ts-ignore` with an ambient module
  declaration.
- Add a `ttsx` failed-type-check assertion that explicit cache-dir runtime
  output is cleaned.
- Extend the huge-decimal lint test through `assertRuleCorpusCase`.
- Reword wasm API comments so Go `APIResult` is not confused with the JS
  `ITtscResult` envelope.
- Align paths, ttsx, architecture, and wasm docs with current source behavior.
- Force-add research-review artifacts and run a current benchmark before push.

## Deferred

- Benchmark execution is deferred until after the final no-proposal review
  round and validation.

## Rejected

- No source behavior change outside the existing PR architecture was accepted.
