# Validation

Prove a change first with the narrowest test that fails without it, then run affected local checks and let CI run the full suites. Keep test selection in root commands and retain every failing verdict when a command continues after a failure.

`pnpm test` skips units when Go fails, so run `pnpm test:units` explicitly as well. Run `pnpm build` before `pnpm test:e2e`. Do not block a push on a full local run or install a toolchain just for one; let the configured CI run full suites. Never meet the ten-minute job target by dropping cases or splitting jobs.

Run `pnpm format` once during final preparation for merge. Fix any later defect without running it again.
