# Review Round 4 Lead Validation

Lead validation accepted the local fixes above after checking them against
source behavior and existing repository patterns.

Applied validation:

- Verified TypeScript-Go emits `.mjs`, `.cjs`, and `.jsx` for matching source
  and `jsx: preserve` cases before updating `@ttsc/paths`.
- Added the feature test under `tests/test-paths/src/features/`, using the
  existing `TestPaths` harness.
- Kept test changes scoped; no skipped/deleted tests were introduced.
- Kept docs in the website guide layer because behavior/user-facing command
  semantics changed.

Validation run after applying round-4 fixes:

- `node scripts/test-go-utility-plugins.cjs`
- `pnpm --filter @ttsc/test-paths start`
- `pnpm --filter ttsc build`
- `pnpm run test:go`
- `pnpm run test:typecheck`
- `pnpm --filter @ttsc/test-ttsc start -- --include=runner_corpus_invalid_tsconfig,ttsx_relative_cache_dir`
- `pnpm --dir website build`
