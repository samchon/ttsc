# Review Round 3 Proposals

## Accepted

- Make `ttsx` cleanup best-effort in `runPreparedEntry`.
- Clean `prepareExecution` runtime output on post-build failures.
- Add LSP test coverage proving hard transport errors close sibling streams.
- Restore deterministic `allowJs` path lookup by probing JavaScript source
  extensions after TypeScript extensions.
- Add paths helper tests for JavaScript extensionless lookup and `.ts` priority
  over `.js`.
- Update no-loss-of-precision comments, add a huge-decimal guard, and test it.
- Simplify wasm host capture cleanup and update MemFS comments/docs.
- Fix the TS feature doc comment headline.
- Soften the banner generated-loader test to assert control-flow order instead
  of exact source formatting.
- Update stale documentation for paths internals, LSP driver helpers, ttsx
  cache semantics, wasm MemFS copy semantics, and `pnpm test:go`.

## Deferred

- A full MemFS unit-test harness was not added in this round because the
  existing workspace test runner does not currently build `@ttsc/wasm` before
  `tests/test-ttsc`. The byte-copy behavior already exists in source; this
  round documents it and keeps validation to `@ttsc/wasm` TypeScript build.

## Rejected

- No proposal requiring a plugin protocol change, package-boundary move, or
  consumer-specific behavior was accepted.
