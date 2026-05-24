# Agent F Final Sweep

Scope: deferred round-1 proposals and current diff. No source edits.

## Recommendation

Accept one test-only follow-up: add coverage for the new `ttsc --version`
executable-bit repair path.

## Evidence

- `getCompilerVersionText.ts` now routes version execution through
  `spawnNative()`.
- Existing version banner tests use an already-executable workspace tsgo binary.
- `tests/test-ttsc/src/internal/toolchain.ts` can create a fake consumer
  `@typescript/native-preview` and run without TTSC overrides.

## Validation

- `pnpm --filter ttsc build`
- `pnpm --dir tests/test-ttsc start -- --include=test_ttsc_version_makes_consumer_tsgo_executable_before_spawn`
