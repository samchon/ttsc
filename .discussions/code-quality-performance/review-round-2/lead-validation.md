# Research Review Round 2 Lead Validation

Accepted and applied:

- LSP header parsing now uses chunked `ReadSlice('\n')` and rejects oversized
  unterminated headers before buffering a full line.
- `ttsx` cleanup now wraps ESM rewrite, package marker writing, and child spawn.
- `execute.mdx` documents temporary runtime emit and persistent plugin cache.
- `paths.mdx` and `paths.go` describe exact source-file keys plus deterministic
  extension probing.
- Banner default unwrapping stops once a banner object is already found, with
  focused script and TypeScript-loader source tests.
- Paths ambiguous-stem regression was moved to a focused one-case file.
- MemFS now copies data on read and write.
- Wasm capture temp files now have deferred cleanup.
- `no-loss-of-precision` now compares parse/format round trips and accepts
  exactly representable unsafe integers.
- Added `ttsc --version` executable-bit repair coverage.

Deferred:

- Closing `editorOut` after LSP hard errors. Needs a blocked-writer repro first.
- More Windows junction fallback coverage. Needs Windows CI or local Windows.
- Unrelated website blog/article files.

Validation completed:

- `go test ./test/driver -run 'TestLSP(FrameReaderRejectsOversizeHeader|FrameReaderRejectsOversizeContentLength|ProxySkipsCodeActionWithNonIDShape|ProxyRejectsBadCancelAndCodeActionPayloads|EnvelopeIDKeyRejectsNonIDShapes|ProxyRunReportsEditorWriteError|ProxyRunReturnsUpstreamWriteError)' -count=1`
- `node scripts/test-go-utility-plugins.cjs`
- `node scripts/test-go-lint.cjs`
- `go test ./host -count=1`
- `pnpm --filter @ttsc/wasm build:ts`
- `pnpm --filter ttsc build`
- `pnpm --dir tests/test-ttsc start -- --include=test_ttsx_relative_cache_dir_resolves_from_cwd_option,test_plugin_corpus_ttsx_relative_cache_dir_builds_source_plugin_under_cwd_option,test_runner_corpus_ttsx_keeps_configured_outdir_untouched,test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers,test_ttsccompiler_transform_applies_configured_source_plugins_to_typescript_output,test_ttsc_reports_the_consumer_tsgo_version_banner,test_ttsc_version_makes_consumer_tsgo_executable_before_spawn`
- `pnpm run test:typecheck`
- `pnpm --dir tests/test-ttsc start -- --include=test_ttsc_go_package_tests_pass`
- `pnpm --dir website build`
- `pnpm test`
