# Agent C Knowledge Base - Lint/Wasm/Test Infra

Scope read: current diff for lint, wasm, scripts, and `AGENTS.md`.

Findings:

- Code quality and docs improved. The no-loss-of-precision rule documents its
  source-text round-trip contract, wasm temp-file capture has one cleanup path,
  and MemFS byte-copy behavior is documented.
- No weakened tests, deleted tests, consumer-specific hardcoding, or blocking
  over-optimization was found.
- The 309-digit cutoff is a domain constant derived from `Number.MAX_VALUE`,
  not a benchmark-only constant.

Proposal deferred:

- A larger huge-decimal test would make the "do not parse arbitrary long text"
  rationale more obvious, but current behavior is correct and the existing test
  already pins the overflow-scale boundary. No code change accepted.
