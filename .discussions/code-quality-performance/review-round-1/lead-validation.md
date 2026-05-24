# Research Review Round 1 Lead Validation

Accepted and applied:

- Agent 1.1: `ttsx` ESM rewrite now splits query/hash suffixes before extension
  checks, with a feature test for extensioned query/hash imports.
- Agent 1.2: `transformProjectInMemory` resolves tsgo once for native plugin
  spawns.
- Agent 1.3: `ttsc --version` now uses `spawnNative`.
- Agent 2.1: LSP code-action bookkeeping ignores empty id keys.
- Agent 2.2: `Proxy.Run` closes closeable peer streams after the first hard
  pump error.
- Agent 2.3: LSP frame parsing caps header blocks at 64 KiB.
- Agent 2.4: `ttsx` cleans PID-scoped project output after successful child
  execution while leaving plugin cache intact.
- Agent 3.1: `no-loss-of-precision` reports `9007199254740992`.
- Agent 4.1: banner JS/TS config loaders now use a 60s subprocess timeout and
  Windows junction fallback for projected `node_modules`.
- Agent 4.2: banner JS/CJS configs unwrap nested defaults up to eight levels.
- Agent 4.3: paths resolution now uses deterministic extension priority for
  ambiguous stems.
- Agent 4.5-4.7: wasm output capture is serialized; MemFS maps `EINVAL` and
  `ESPIPE`; `writeFile` copies caller-owned binary buffers.
- Agent 5.1-5.3: root `pnpm test` includes Go runners, Go runners use
  `-count=1`, and test spawn wrappers preserve custom env.

Rejected or deferred:

- Agent 2.5 / Agent 1 cache memoization: rejected for now. Cache-key correctness
  is a product contract, and broad memoization can reuse stale toolchain or
  source identities in long-lived processes.
- Agent 2.6 unknown-field-preserving LSP augmentation: deferred. Correct, but
  larger than the hardening fixes and needs dedicated protocol regression tests.
- Agent 3.2 permission preservation: not applied. Existing Go write semantics
  do not chmod existing files when `os.WriteFile` opens with `O_TRUNC`; the
  proposed change would only affect newly created files, which the fix path
  should not normally create.
- Agent 3.3-3.7 lint performance refactors: deferred. They are plausible but
  touch subtle directive, glob, formatter, and import semantics.
- Agent 4.4 unplugin mtime/size shortcut: deferred. It can reduce cache-hit
  cost, but only with a careful invalidation design.
- Agent 5.4-5.5 helper extraction and build scheduling: deferred as cleanup
  rather than direct quality/performance fixes.
- Agent 6 proposals: deferred to a focused website/playground/VSCode round.

Validation completed:

- `go test ./test/driver -run 'TestLSP(FrameReaderRejectsOversizeHeader|FrameReaderRejectsOversizeContentLength|ProxySkipsCodeActionWithNonIDShape|ProxyRejectsBadCancelAndCodeActionPayloads|EnvelopeIDKeyRejectsNonIDShapes|ProxyRunReportsEditorWriteError|ProxyRunReturnsUpstreamWriteError)'`
- `node scripts/test-go-lint.cjs`
- `go test ./host`
- `node scripts/test-go-utility-plugins.cjs`
- `node scripts/test-go-transformer.cjs`
- `pnpm --filter ttsc build`
- `pnpm --dir tests/test-ttsc start -- --include=test_ttsx_relative_cache_dir_resolves_from_cwd_option,test_plugin_corpus_ttsx_relative_cache_dir_builds_source_plugin_under_cwd_option,test_runner_corpus_ttsx_keeps_configured_outdir_untouched`
- `pnpm --dir tests/test-ttsc start -- --include=test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers,test_ttsccompiler_transform_applies_configured_source_plugins_to_typescript_output,test_ttsc_reports_the_consumer_tsgo_version_banner`
- `pnpm run test:typecheck`

Validation notes:

- Direct `go test ./test` inside `packages/banner` and `packages/paths` failed
  before running tests because those packages need the repository scratch
  `go.work` overlay. The supported wrapper `node scripts/test-go-utility-plugins.cjs`
  passed and covers banner, paths, and strip.
