---
name: development
description: Repairs, implements, tests, and validates ttsc source, tests, fixtures, workflows, and package wiring. Use before editing any of them; acknowledgments belong to contracts and the typescript-go shim to typescript-go-sync.
---

# Development

## Repair

Before editing, group every known symptom by cause, then trace each cause, and your change, through callers and consumers, error and recovery paths, caches and generated output, Windows and POSIX, and anything observing a new file, write, or timing, such as directory walks, watchers, cache keys, and timestamps. Cover each resulting case with a test, fix the owner, and delete the compensations the fix makes unnecessary.

## Code

- Plugin descriptors are JS and transform logic is Go; JS transform functions are not public contract.
- First-party plugin options live in a `*.config.*` file found by an upward walk from the entry. Shipped packages accept only `configFile` beyond host entry keys.
- In `packages/ttsc/src`, a file exports one symbol named after it, right after the imports; helpers of one concern become one namespace.
- Update the matching guide under `website/src/content/docs/` in the same change.
- Tests, fixtures, CI, wiring, dependencies, and generated baselines are specification. Change them only on request or for a product reason, and say so.

## Tests

| Kind | Location |
| --- | --- |
| Go | Beside its Go package, one `Test*` per file. Never under `tests/`. |
| TypeScript unit | `tests/test-*/src/features/test_<name>.ts` exporting `test_<name>`, calling the source directly. |
| E2E | One experiment per package in `tests/test-e2e/src/features/test_e2e_<package>.ts`, with static inputs in `tests/test-e2e/fixtures/<package>/<scenario>/`. |

- A unit needs no installed consumer, native build, or real host; anything that needs one is E2E. Keep E2E to the connection units cannot reach, and share one preparation among cases with equivalent inputs.
- Delete assertions about repository shape, such as export lists, versions, or file and workflow contents, instead of moving them.
- Observe through the product's seams or its own output; never replace `fs` functions or `process.env` in a test.
- Open each case with a `Verifies` headline, a short reason, and two to four numbered steps. Reuse `tests/utils` and the suite's own `internal/`, never another suite's.

## Validation And CI

- Before finishing, prove the change with the narrowest test that fails without it. Run the affected tests locally, then let CI run the full suites; never block a push on a full local run or install a toolchain for one.
- `pnpm test` skips the units when Go fails, so run `pnpm test:units` as well. `pnpm test:e2e` needs `pnpm build` first.
- Workflows call root commands. Keep test selection there, keep every failing verdict when continuing past a failure, and never meet the ten-minute job target by dropping cases or splitting jobs.
- Run `pnpm format` once, at a pull request's final preparation for merge; fix any later defect without rerunning it.
