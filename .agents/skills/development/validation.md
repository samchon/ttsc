# Validation

Read this document when choosing or completing verification commands. Test construction belongs to [testing.md](testing.md), and selection checks belong to [evidence.md](evidence.md). The [CI workflows](#ci-workflows) section owns CI execution. Follow it instead of adding lanes to make repeated work appear shorter.

## Verification Commands

Run the narrowest command that proves the change first, then a broader command when shared behavior or packaging changed. Report any command that could not be run.

Under [AGENTS.md's **Collect every symptom before correcting** rule](../../../AGENTS.md#attitude), a run has finished only when every case it selects has run, apart from cases blocked by a failure they depend on, such as tests behind a broken build. `pnpm test:units` uses `--no-bail` to collect every selected package, but `pnpm test` chains Go and unit tests with `&&`, so a Go failure skips the independent units. Run any independently skipped population before the [consequence analysis](implementation.md#consequence-analysis) begins.

Verification shape depends on the change type:

- **Bug fix**: name the failing case and the expected behavior; run a repro that fails before the fix and passes after.
- **Feature**: name the observable behavior; exercise it end-to-end.
- **Refactor**: name what should stay unchanged; rely on the existing test suite or a behavior-locking probe.

## Inputs And Results

Record the source and fixture state used by a run. Coordinate shared writers before execution, and retain an immutable input snapshot when the run must outlive edits. If inputs change during execution, identify the affected cases and verify them against the final state; results from different source states do not establish one verified change.

Read each completed command's full result and report selected cases, failures, blocked or skipped cases and commands that could not run. Recheck the affected selection after a coherent correction, then broaden only when shared behavior, packaging or an unresolved concern requires it.

## CI Workflows

Every verification workflow runs on `pull_request` only, checks out, sets up Node, pnpm and Go, runs `pnpm install --frozen-lockfile`, and then calls the root commands below. Each workflow cancels the superseded run of its branch. Keep test selection and product logic in their owning root commands rather than duplicating them in workflow wrappers. Workflow wiring may select its OS and matching native package, transport Go module/object caches under host/toolchain-specific keys and diagnostic paths, and use conditions to collect independent test populations after another population fails. Preserve each population's failing verdict.

| Workflow | Commands |
| --- | --- |
| `build.yml` | `pnpm run evidence`, then `pnpm run build`. Evidence checks the production declarations and every test package before the build. |
| `test.yml` | Windows x64, Linux x64 and macOS arm64 each prepare their native platform package on Node 24. `pnpm run test:go` runs native `go test` in the seven top-level package Go modules and the nested `shim/ast`, `shim/vfs`, `tools/gen_shims` and `tools/shim_audit` modules. It independently runs the direct units in the standalone `test/go-transformer` and `test/fixtures/process-observer` fixture modules with `GOWORK=off`, then the js/wasm host units through that toolchain's Node runner. Every population runs even after another fails, and any failure fails the command. After successful preparation, `pnpm run test:units` runs `pnpm start` in every `tests/test-*` package except `tests/test-e2e`, including when Go tests failed. Matrix entries do not cancel one another. |
| `e2e.yml` | Windows x64, Linux arm64 and macOS arm64 each build on Node 24, then run the full `pnpm run test:e2e` suite on Node 24, the exact `packages/ttsc/package.json` engine floor and newest Node (`current`), respectively. An invalid floor declaration fails selection. Every full shared suite packs and installs the matching platform package and SDK into its bare consumer; its Runtime preserves the installation values and actual installed CLI boundary in that same preparation. The former separate `setup.yml` matrix is absorbed here without adding OS/version combinations. Existing private tracing uses an absolute runner-owned root for the E2E command, and per-platform artifacts retain JSONL events and integrity markers after failures; no new case or validation command is added. |
| `typia.yml`, `nestia.yml` | Compatibility with the latest upstream master, wired by `.github/workflows/scripts/consumer.cjs`: candidate tarballs, a pnpm hook that binds peers to them, package patches and, for Go tests, a `go.work` over the candidate driver and shims. |
| `website.yml`, `benchmark.yml` | The website build with deployment on a master push, and the benchmark packages' type check. |
| `release.yml` | A pushed tag runs `pnpm run build`, publishes the VS Code extension without failing the release, then publishes the packages with provenance. |

A `tests/test-*` package starts its unit through the TypeScript loaders in `config/`; its `start` script names the one it needs. A job's ten minute target is measured from a successful run, never met by timeouts, omitted cases or split jobs.
