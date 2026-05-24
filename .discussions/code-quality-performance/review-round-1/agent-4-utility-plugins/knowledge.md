# Agent 4 Knowledge: Utility Plugins, Adapters, Wasm

Scope read:
- `packages/banner`: README, package metadata, TS descriptor, Go driver, native wrapper, and Go tests.
- `packages/paths`: README, package metadata, JS descriptor, Go driver, native wrapper, and Go tests.
- `packages/strip`: README, package metadata, JS/types descriptor, Go config/transform drivers, native wrapper, and Go tests.
- `packages/unplugin`: README, package metadata, rollup config, all `src/**`, and `tests/test-unplugin` adapter/transform coverage.
- `packages/wasm`: README, package metadata, TS runtime, Go host/cmd/build helpers. No local wasm tests were present.

Architecture notes:
- Utility plugins keep JS descriptors thin and put transform behavior in Go sidecars.
- `@ttsc/banner` and `@ttsc/strip` have similar config-file loading paths, but strip has a subprocess timeout and Windows junction fallback that banner lacks.
- `@ttsc/paths` resolves aliases from the TypeScript-Go program and mutates string-literal module specifiers in-place.
- `@ttsc/unplugin` intentionally compiles project-wide through `TtscCompiler.transform()` and caches per generated-tsconfig key. Tests require invalidation when any project or plugin-read file changes.
- `@ttsc/wasm` exposes a JS Promise API over a Go wasm host, with a custom MemFS shim for browser filesystem syscalls.

Concrete proposals:
1. Harden banner config loaders.
   - Evidence: `packages/banner/driver/banner.go:314` and `packages/banner/driver/banner.go:379` run Node/ttsx without a timeout, while `packages/strip/driver/config.go:223` and `packages/strip/driver/config.go:331` use a 60s context deadline. `packages/banner/driver/banner.go:538` uses symlink-only node_modules projection, while `packages/strip/driver/config.go:452` has a Windows junction fallback.
   - Change: align banner with strip by adding `context.WithTimeout`, timeout-specific errors, and the Windows junction fallback.
   - Risk: medium. A hanging user config becomes a deterministic error after the deadline.
   - Validation: `go test ./packages/banner/test -run 'Test(ScriptConfigLoader|TypeScriptConfigLoader|NodeEnvironmentHelpers)'`.

2. Make banner JS/CJS config default-export unwrapping match strip and TS configs.
   - Evidence: `packages/banner/driver/banner.go:297` unwraps only one `default`, but `packages/strip/driver/config.go:196` unwraps nested defaults up to eight levels and `packages/banner/driver/banner.go:433` does the same for TypeScript config.
   - Change: use the same bounded default-unwrapping loop in the banner JavaScript loader.
   - Risk: low. Existing valid exports still work; transpiled CJS `exports.default = ...` becomes accepted.
   - Validation: add a CJS default-export case to `packages/banner/test/script_config_loader_test.go`, then run `go test ./packages/banner/test -run TestScriptConfigLoader`.

3. Make paths stem resolution deterministic when multiple source files share a basename.
   - Evidence: `packages/paths/driver/paths.go:64` stores both exact paths and extension-stripped stems in one map, so the last program file wins for `src/foo` when `foo.ts` and `foo.tsx` both exist. `packages/paths/driver/paths.go:205` then checks the stem before the explicit extension-priority loop at `packages/paths/driver/paths.go:213`.
   - Change: avoid overwriting stem aliases, or remove stem aliases and let `lookupSource`'s extension-priority loop decide.
   - Risk: medium. It changes ambiguous alias resolution, but toward deterministic TypeScript-like priority.
   - Validation: add a helper case in `packages/paths/test/rewriter_helpers_cover_resolution_edges_test.go`, then run `go test ./packages/paths/test -run TestRewriterHelpersCoverResolutionEdges`.

4. Reduce unplugin cache-hit hashing cost without weakening invalidation.
   - Evidence: on every cache hit, `packages/unplugin/src/core/transform.ts:211` calls `collectProjectInputHashes`, which walks the project at `packages/unplugin/src/core/transform.ts:275` and reads/hashes every regular file at `packages/unplugin/src/core/transform.ts:256`. Tests under `tests/test-unplugin/src/features/transform/test_transformttsc_invalidates_project_cache_when_*` require broad invalidation.
   - Change: keep broad coverage, but store `mtimeMs`/`size` alongside hashes and re-read only files whose metadata changed; still hash the in-memory current source overlay.
   - Risk: medium. Cache correctness is sensitive; preserve the existing invalidation tests.
   - Validation: `pnpm --filter @ttsc/test-unplugin start`.

5. Serialize wasm plugin stdout/stderr capture.
   - Evidence: `packages/wasm/host/host.go:237` runs Promise work in goroutines, and `packages/wasm/host/host.go:296` mutates package-global `os.Stdout`/`os.Stderr` until `packages/wasm/host/host.go:346`. `packages/wasm/host/host.go:360` only avoids temp filename collisions, not stream interleaving.
   - Change: add a package-level mutex around `runWithCapturedIO`.
   - Risk: low to medium. Concurrent plugin calls serialize, but captured output becomes correct.
   - Validation: add a concurrent plugin-dispatch wasm test if the js/wasm runner is available; minimally run `pnpm --filter @ttsc/wasm build:ts`.

6. Complete MemFS errno mappings for errors it already emits.
   - Evidence: `packages/wasm/src/MemFS.ts:562` emits `ESPIPE` and `packages/wasm/src/MemFS.ts:780` emits `EINVAL`, but `errnoForCode` at `packages/wasm/src/MemFS.ts:221` falls through to `-1` for both.
   - Change: add explicit `EINVAL: -22` and `ESPIPE: -29` mappings, and optionally make `EPERM: -1` explicit.
   - Risk: low.
   - Validation: `pnpm --filter @ttsc/wasm build:ts`.

7. Copy caller-owned Uint8Array inputs in MemFS writeFile.
   - Evidence: `packages/wasm/src/MemFS.ts:402` stores a provided `Uint8Array` directly at `packages/wasm/src/MemFS.ts:405`, so external mutation after `writeFile` mutates virtual file contents.
   - Change: store `new Uint8Array(data)` for binary inputs.
   - Risk: low. It adds one copy at write boundaries and makes file contents ownership explicit.
   - Validation: add a MemFS unit fixture when wasm TS tests exist; minimally run `pnpm --filter @ttsc/wasm build:ts`.

No product source was edited in this agent pass.
