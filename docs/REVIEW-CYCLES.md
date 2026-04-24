# Review Cycles

This file records the initial standalone migration review from `../typia@next/toolchain`.

## Cycle 1. Package Boundary

- Moved `ttsc` and `ttsx` into `packages/*`.
- Renamed package contracts from `@typia/ttsc` / `@typia/ttsx` to `ttsc` / `ttsx`.
- Updated Go module path to `github.com/samchon/ttsc/packages/ttsc`.

## Cycle 2. Consumer Coupling

- Removed runtime imports of `@typia/ttsc`.
- Removed `ttsx` cache salt probes for consumer package native folders.
- Replaced project tests that used `typia/lib/transform` as a dummy plugin path with generic local plugin paths.

## Cycle 3. TypeScript-Go Wrapper

- Verified `packages/ttsc/go.mod` pins `github.com/microsoft/typescript-go v0.0.0-20260408193441-2a5e1cf9fe22`.
- Verified shim modules are wired through local `replace` entries.
- Verified `go test ./...` passes under `packages/ttsc`.

## Cycle 4. CLI And JS API

- Built `ttsc` through its Go-hosted build lane.
- Built `ttsc-native`.
- Built `ttsx` through the workspace-linked `ttsc`.

## Cycle 5. Generic Plugin Host

- Added a standalone smoke fixture with a generic `transformOutput` plugin.
- Verified `ttsc transform` composes plugin post-processing with native emit.

## Cycle 6. Diagnostics

- Added a standalone semantic-error fixture.
- Verified `ttsc --emit` blocks before writing JavaScript when TypeScript-Go reports a semantic diagnostic.

## Cycle 7. Runner

- Added a standalone `ttsx` CommonJS runner fixture.
- Verified `ttsx` executes a TypeScript entry through the shared `ttsc` host.

## Cycle 8. Maintenance Contract

- Added `AGENTS.md` with TypeScript-Go drift policy, required commands, review surfaces, and local reference repositories.
- Added root workspace README.

## Cycle 9. Reference Repository Review

- Compared `ttsc`/`ttsx` against `/home/samchon/github/contributions/typescript-go`, `tsgolint`, `tsgonest`, and `typical`.
- Replaced manual diagnostic collection with `GetDiagnosticsOfAnyProgram` to match TypeScript-Go and `tsgonest` diagnostic ordering.
- Added bind-diagnostic smoke coverage.
- Added `ttsx` ESM runner smoke coverage.
- Added `wiki/` reference ledgers, gap analysis, self-review, and CI/test documentation.
- Added GitHub Actions workflow for the build/test/vet gate.

## Cycle 10. Reference Test Corpus Hardening

- Borrowed test pressure from `../../contributions/ts-patch`, `tsx`, `ts-node`, and TypeScript-Go.
- Added package tests for package `extends`, JSONC config, and circular `extends`.
- Added smoke tests for chained/disabled plugins, `jsconfig` auto-detection, current `paths` resolution, declaration emit, `transformAsync`, argv/preload, and `.mts` execution.
- Fixed JS API config forwarding so auto-detected `jsconfig.json` reaches the native binary.
- Fixed emitted extension handling for `.mjs` / `.cjs` outputs in `ttsc` and `ttsx`.

## Cycle 11. Multi-Project Test Program Expansion

- Split smoke coverage into a shared helper plus separate compiler/plugin/runner corpus files.
- Added compiler projects for single-file mode, explicit external project config, noEmit, emitDeclarationOnly, source maps, and syntax diagnostic blocking.
- Added plugin projects for default export factory, `createTtscPlugin`, native mode conflict, invalid export, and transform `--out`.
- Added runner projects for `.cts`, nested tsconfig discovery, explicit project override, and diagnostic-blocked execution.
- Raised smoke end-to-end coverage to 30 tests.

## Cycle 12. ts-node-Style Transform Project Corpus

- Removed tarball/package validation from the active gate; correctness is build/test/vet.
- Added `tests/smoke/test/transform-projects.test.cjs` with multiple small transform projects modeled after `ts-node` fixture pressure.
- Covered CommonJS `.ts`, `.cts -> .cjs`, `.mts -> .mjs`, `.tsx` JSX lowering, file paths with spaces, tsconfig `extends`, and transform diagnostics.
- Raised smoke end-to-end coverage to 37 tests.

## Cycle 13. Monorepo Export Contract

- Changed `ttsc` and `ttsx` package metadata so workspace `main`, `types`, and `exports.types` point at `src/index.ts`.
- Added `publishConfig.main`, `publishConfig.types`, and `publishConfig.exports` that point at built `lib` outputs.
- Kept runtime `exports.default` on built `lib` so CommonJS smoke plugins can still `require("ttsc")` during local tests.
- Added package metadata tests for the source-vs-publish export split.

## Cycle 14. Real Fixture Projects And Go Transformer Backend

- Moved the ts-node-style transform corpus into real project directories under `tests/projects/*`.
- Changed `tests/smoke/test/transform-projects.test.cjs` to copy those projects and execute them instead of hiding the corpus inside test-local builders.
- Added `tests/go-transformer`, a standalone Go module with a transformer library, Go unit test, and `cmd/ttsc-go-transformer` native backend binary.
- Added `tests/projects/go-native-transformer`, which selects the Go native transformer through plugin configuration and verifies the transformed JavaScript by running the emitted file.
- Added the Go transformer module to the root `test` gate and kept the active correctness gate on build/test/vet, not tarball packaging.
- Raised smoke end-to-end coverage to 38 tests.

## Cycle 15. Root Scripts And Release Workflows

- Reduced root development scripts to direct `build` and full `test` gates, with `test` building required local artifacts before package, Go transformer, and smoke tests.
- Split GitHub Actions into typia-style `build.yml` and `test.yml` with PR path triggers.
- Added typia-style `release.yml` for tag-triggered npm publish plus `changelogithub`, without adding extra CI setup steps beyond the copied release shape.
- Added `package:latest`, `package:next`, `release`, and `next.bash`; publishing targets only `packages/*` because this repository has no `toolchain/*` workspace.
- Added `bumpp` as the release-versioning dependency.
