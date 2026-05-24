# Agent C Knowledge Base - Lint/Wasm/Test Infra

Scope read: changed `packages/lint/linthost/rules_problems.go`,
`packages/lint/test`, `packages/wasm/{host,src}`, root test scripts, and
`package.json`.

Findings:

- The no-loss-of-precision rule is materially more correct because it now uses
  source-text round-tripping instead of a simple unsafe-integer threshold. That
  avoids false positives for exactly representable unsafe integers such as
  `9007199254740992`.
- The rule comments still described the old unsafe-integer threshold and should
  be corrected to the actual source-text round-trip contract.
- Very large decimal integers can be rejected before `ParseFloat`; the
  threshold is a spec-derived guard (`Number.MAX_VALUE` has 309 integer digits),
  not a benchmark-only hardcode.
- WASM stdout/stderr capture is better after serializing global stream swaps.
  The cleanup block still duplicated close/remove logic and could be clearer.
- MemFS already copies `writeFile` byte input and `readFile` output. Comments
  and docs should say that contract directly.
- `scripts/test-go-lint.cjs` had a stale comment that said `go test ./linthost`
  while the actual command runs `go test -count=1 ./linthost`.

Proposals:

- Update no-loss-of-precision comments and add a focused huge-decimal test.
- Add a finite-size fast path for decimal integer strings longer than any
  finite JavaScript Number can represent.
- Simplify wasm capture cleanup to a single deferred remove path.
- Update MemFS comments/docs for copy semantics.
- Update the stale `test-go-lint` runner comment and document `pnpm test:go` in
  `AGENTS.md`.
