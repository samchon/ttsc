# Validation

Prove a change first with the narrowest test that fails without it. Local tests must select cases or packages affected by the change; run full suites only in GitHub CI. Keep test selection in root commands and retain every failing verdict when a command continues after a failure.

Build the required packages before a filtered E2E run. Check the CI commands cover both Go and TypeScript units: `pnpm test` skips units when Go fails, so CI must also run `pnpm test:units` independently. Do not block a push on a full local run or install a toolchain just for one. Never meet the ten-minute job target by dropping cases or splitting jobs.

Run `pnpm format` once during final preparation for merge. Fix any later defect without running it again.
