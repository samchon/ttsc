# Validation

Read this document when choosing or completing verification commands. Test construction belongs to [testing.md](testing.md), and selection checks belong to [evidence.md](evidence.md). The [CI workflows](#ci-workflows) section owns CI execution. Follow it instead of adding lanes to make repeated work appear shorter.

## Verification Commands

Run the narrowest command that proves the change first, then a broader command when shared behavior or packaging changed. Report any command that could not be run.

Under [AGENTS.md's **Collect every symptom before correcting** rule](../../../AGENTS.md#attitude), a run has finished only when every case it selects has run, apart from cases blocked by a failure they depend on, such as tests behind a broken build. A runner that stops at its first failure skips cases nothing blocked, so it has not finished: `pnpm test:features` is a recursive `pnpm` run that skips every test package after the first failing one, and `pnpm test` chains its steps with `&&`. Run what they skipped before the [consequence analysis](implementation.md#consequence-analysis) begins.

Verification shape depends on the change type:

- **Bug fix**: name the failing case and the expected behavior; run a repro that fails before the fix and passes after.
- **Feature**: name the observable behavior; exercise it end-to-end.
- **Refactor**: name what should stay unchanged; rely on the existing test suite or a behavior-locking probe.
- **Review**: name concrete risks, missing tests, or regressions.

## Inputs And Results

Record the source and fixture state used by a run. Coordinate shared writers before execution, and retain an immutable input snapshot when the run must outlive edits. If inputs change during execution, identify the affected cases and verify them against the final state; results from different source states do not establish one verified change.

Read each completed command's full result and report selected cases, failures, blocked or skipped cases and commands that could not run. Recheck the affected selection after a coherent correction, then broaden only when shared behavior, packaging or an unresolved concern requires it.

## CI Workflows

Every verification workflow runs on `pull_request` only, checks out, sets up Node, pnpm and Go, runs `pnpm install --frozen-lockfile`, and then calls the root commands below. Each workflow cancels the superseded run of its branch. A workflow holds no wrapper script, cache restoration, conditional step or environment toggle.

| Workflow | Commands |
| --- | --- |
| `build.yml` | `pnpm run evidence`, then `pnpm run build`. Evidence checks the production declarations and every test package before the build. |
| `test.yml` | `pnpm run test:go` runs `go test` in each Go module owned by a package. `pnpm run test:units` runs `pnpm start` in every `tests/test-*` package except `tests/test-e2e`. |
| `e2e.yml` | `pnpm run build`, then `pnpm run test:e2e`, the `pnpm start` of `tests/test-e2e`. |
| `setup.yml` | The only installation matrix: Linux, macOS and Windows on x64 and arm64. Each row builds `ttsc` and its platform package, then runs the installation experiment of `tests/test-e2e` (`start --installation`), which packs and installs them into a bare consumer. |
| `typia.yml`, `nestia.yml` | Compatibility with the latest upstream master, wired by `.github/workflows/scripts/consumer.cjs`: candidate tarballs, a pnpm hook that binds peers to them, package patches and, for Go tests, a `go.work` over the candidate driver and shims. |
| `website.yml`, `benchmark.yml` | The website build with deployment on a master push, and the benchmark packages' type check. |
| `release.yml` | A pushed tag runs `pnpm run build`, publishes the VS Code extension without failing the release, then publishes the packages with provenance. |

A `tests/test-*` package starts its unit through the TypeScript loaders in `config/`; its `start` script names the one it needs. A job's ten minute target is measured from a successful run, never met by timeouts, omitted cases or split jobs.
