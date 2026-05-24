# Agent 2: LSP, Runtime, Process Boundaries

## Scope Read

- Read `packages/ttsc/internal/lspserver/*.go`, `packages/ttsc/cmd/ttscserver/*.go`, and the public driver LSP re-export in `packages/ttsc/driver/lsp.go`.
- Read the `ttsx` runtime path through `packages/ttsc/src/launcher/internal/runTtsx.ts`, `prepareExecution.ts`, `runBuild.ts`, `spawnNative.ts`, `resolveTsgo.ts`, and emitted-file resolution.
- Read plugin sidecar build/load/protocol code in `packages/ttsc/src/plugin/internal/*`, `packages/ttsc/driver/plugins.go`, `packages/ttsc/utility/host.go`, and native API command adapters.
- Read the VSCode reference client in `packages/vscode/src/extension.ts`, package metadata, installer, build script, and the JS `ttscserver` launcher.
- Spot-checked nearby LSP and ttsx feature tests to understand existing coverage and validation commands.

## Findings

- `Proxy.rememberCodeActionRequest` stores `pendingActions[env.IDKey()]` without checking for the empty key. `idKeyFromRaw` intentionally returns `""` for non-LSP id shapes, and tests document that callers should treat that as "no entry".
- `Proxy.Run` waits for both pump goroutines even after one pump reports a hard I/O error. The pump methods ignore the context parameter; current tests close the opposite stream manually before expecting `Run` to return, which leaves a production hang risk when only one side fails.
- `FrameReader.Read` caps `Content-Length` bodies at 64 MiB, but header lines and the total header block are unbounded before the body cap is reached.
- `ttsx` emits into `cacheDir/project/<pid>` and removes that directory only before a build or on build failure. Successful runs leave PID-named virtual project trees behind; plugin binary cache reuse is separate and would not be harmed by cleaning the project tree after the child process exits.
- Source plugin cache keys repeatedly hash Go toolchain identity, Go root identity, and ttsc overlay directories for every plugin built in one JS process. Multi-plugin projects pay the same expensive filesystem walk several times.
- LSP augmentation rewrites envelopes by unmarshalling into narrow structs and marshalling them back. That is correct for known LSP fields, but it drops unknown JSON-RPC or params fields on augmented publishDiagnostics/codeAction frames.

## Proposals

1. Skip empty JSON-RPC id keys in LSP code-action bookkeeping.
   - References: `packages/ttsc/internal/lspserver/lsp_proxy.go:186`, `packages/ttsc/internal/lspserver/lsp_proxy.go:294`, `packages/ttsc/internal/lspserver/lsp_envelope.go:103`, `packages/ttsc/test/driver/lsp_envelope_idkey_rejects_non_id_shapes_test.go:9`.
   - Risk: low.
   - Fix shape: compute `key := env.IDKey()` once; if `key == ""`, do not store or look up pending code-action state.
   - Minimal validation: `go test ./test/driver -run 'TestLSPProxySkipsCodeActionWithNonIDShape|TestLSPProxyRejectsBadCancelAndCodeActionPayloads|TestLSPEnvelopeIDKeyRejectsNonIDShapes'`.

2. Make `Proxy.Run` tear down the opposite pump after the first hard error.
   - References: `packages/ttsc/internal/lspserver/lsp_proxy.go:79`, `packages/ttsc/internal/lspserver/lsp_proxy.go:100`, `packages/ttsc/internal/lspserver/lsp_proxy.go:255`, `packages/ttsc/test/driver/lsp_proxy_run_returns_upstream_write_error_test.go:40`.
   - Risk: medium.
   - Fix shape: on first non-`ErrFrameClosed` error, close the proxied pipe ends that can unblock the other pump, then return the original error after cleanup. Keep graceful EOF/cancel folding unchanged.
   - Minimal validation: `go test ./test/driver -run 'TestLSPProxyRunReturnsAfterOneSidedWriteError|TestLSPProxyRunReportsEditorWriteError|TestLSPProxyRunReturnsUpstreamWriteError'`.

3. Add a maximum LSP header size.
   - References: `packages/ttsc/internal/lspserver/lsp_frame.go:55`, `packages/ttsc/internal/lspserver/lsp_frame.go:78`.
   - Risk: low.
   - Fix shape: track cumulative header bytes and reject a frame once the header block exceeds a small cap, such as 64 KiB, before allocating body storage.
   - Minimal validation: `go test ./test/driver -run 'TestLSPFrameReaderRejectsOversizeHeader|TestLSPFrameReaderRejectsOversizeContentLength|TestLSPFrameReaderReadsWellFormedFrames'`.

4. Clean successful `ttsx` project emit directories after the child process exits.
   - References: `packages/ttsc/src/launcher/internal/prepareExecution.ts:71`, `packages/ttsc/src/launcher/internal/prepareExecution.ts:107`, `packages/ttsc/src/launcher/internal/runTtsx.ts:234`.
   - Risk: medium-low.
   - Fix shape: return the PID-specific `processDir` as cleanup metadata from `prepareExecution`, and wrap `runPreparedEntry` in `try/finally` so `cacheDir/project/<pid>` is removed after `spawnSync` completes. Leave `cacheDir/plugins` intact.
   - Minimal validation: `pnpm --dir tests/test-ttsc start -- --include=test_runner_corpus_ttsx_executes_the_intended_entrypoint_and_side_effects,test_ttsx_relative_cache_dir_resolves_from_cwd_option`.

5. Memoize stable Go/toolchain identity hashes during one plugin-loading process.
   - References: `packages/ttsc/src/plugin/internal/buildSourcePlugin.ts:123`, `packages/ttsc/src/plugin/internal/buildSourcePlugin.ts:916`, `packages/ttsc/src/plugin/internal/buildSourcePlugin.ts:1007`, `packages/ttsc/src/plugin/internal/buildSourcePlugin.ts:1165`.
   - Risk: medium, because cache-key correctness matters.
   - Fix shape: memoize only stable identities for the current process, such as Go binary identity, resolved Go env, GOROOT identity, and ttsc overlay directory hashes. Do not memoize user plugin source directories unless the key includes freshness metadata.
   - Minimal validation: `pnpm --dir tests/test-ttsc start -- --include=test_computecachekey_changes_when_goroot_source_changes,test_computecachekey_changes_when_overlay_source_changes,test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output`.

6. Preserve unknown JSON fields when augmenting LSP frames.
   - References: `packages/ttsc/internal/lspserver/lsp_proxy.go:316`, `packages/ttsc/internal/lspserver/lsp_proxy.go:347`.
   - Risk: medium.
   - Fix shape: patch `params.diagnostics` or `result` through `map[string]json.RawMessage` while retaining unknown top-level and nested fields. Keep malformed upstream frames forwarded verbatim.
   - Minimal validation: `go test ./test/driver -run 'TestLSPProxyPreservesUnknownFieldsWhenAugmenting|TestLSPProxyMergesPublishDiagnostics|TestLSPProxyAugmentsCodeActionResponse'`.

## Validation Run

- `go test ./test/driver -run 'TestLSP(EnvelopeIDKeyRejectsNonIDShapes|ProxyRejectsBadCancelAndCodeActionPayloads|ProxyRunReportsEditorWriteError|ProxyRunReturnsUpstreamWriteError)'`
- `pnpm --dir tests/test-ttsc start -- --include=test_runner_corpus_ttsx_executes_the_intended_entrypoint_and_side_effects`
