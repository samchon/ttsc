# Agent 5: Tests, Fixtures, Scripts

## Scope Read

- Reviewed shared TS helpers under `tests/utils/src`, including process spawning, temp project materialization, lint parsing, and unplugin fixture generation.
- Reviewed root test/build orchestration in `package.json`, `pnpm-workspace.yaml`, `tests/test-*/package.json`, `tests/test-*/tsconfig.json`, and `scripts/*.cjs` / `scripts/*.mjs`.
- Inventoried `tests/test-*/src/features` and confirmed 262 feature files each export exactly one `test_*` function whose name matches the file basename.
- Reviewed fixture layout under `tests/projects` and package-local Go test runner coverage scripts.

## Findings

- Root `pnpm test` currently runs TypeScript feature suites and `packages/ttsc` Go tests indirectly, but existing runners for `packages/{banner,paths,strip}/test`, `packages/lint/test`, and `tests/go-transformer` are not wired into the default test script.
- Several Go test runners call `go test` without `-count=1`; these tests execute command wrappers, scratch modules, generated files, and environment-dependent paths, so cached Go results can hide regressions.
- `tests/test-ttsc/src/internal/toolchain.ts` has local spawn wrappers that discard `options.env`; this makes future tests using that helper with custom env vars silently ineffective. Most current env-heavy tests use `TestProject.spawn`, which already merges env correctly.
- Utility-package feature helpers duplicate `seedPackage` and local Go PATH logic across banner, paths, strip, and the combined utility test helper. This is low risk but raises maintenance cost.
- `scripts/build-current.cjs` invokes five independent pnpm builds serially before building the current platform package; the first phase could be collapsed into one recursive pnpm invocation to let pnpm schedule package builds topologically.

## Proposals

1. Add a root `test:go` script that runs `scripts/test-go-transformer.cjs`, `scripts/test-go-utility-plugins.cjs`, and `scripts/test-go-lint.cjs`, then include it in `test` before `test:features`.
2. Add `-count=1` to non-coverage Go test runners, including `scripts/test-go-transformer.cjs`, `scripts/test-go-lint.cjs`, `scripts/test-go-utility-plugins.cjs`, and the feature test that shells out to `go test ./...` for `packages/ttsc`.
3. Update `tests/test-ttsc/src/internal/toolchain.ts` so `spawn` and `spawnWithoutTsgoOverride` preserve `options.env` while still injecting or removing `TTSC_BINARY` / `TTSC_TSGO_BINARY` intentionally.
4. Consider extracting test-only `seedWorkspacePackage(root, name)` and `goPath()` helpers into `@ttsc/testing` to remove duplicated package-linking logic.
5. Consider changing `scripts/build-current.cjs` to run the JS package builds through one recursive pnpm command before the platform build.
