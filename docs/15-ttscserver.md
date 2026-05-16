# ttscserver — Language Server for ttsc

Audience: package user setting up an editor on top of ttsc, and maintainer
of an editor extension that talks to ttsc through LSP.

`ttscserver` is the third binary the `ttsc` workspace package ships,
alongside `ttsc` (compiler) and `ttsx` (runtime). It hosts the
TypeScript-Go Language Server unmodified and proxies LSP traffic between
the editor and that server, splicing ttsc plugin findings (lint
diagnostics, format-class fixes) into the same JSON-RPC stream.

## What `ttscserver` does

The native ttscserver binary:

1. Reads JSON-RPC frames from stdin (the editor) and forwards them to the
   embedded tsgo LSP server, with two intercepts:
   - `workspace/executeCommand` requests whose command id ttsc owns are
     handled locally; the response carries the resulting WorkspaceEdit.
   - `textDocument/codeAction` requests are remembered so the matching
     response can be augmented with ttsc-owned code actions.
2. Reads outbound frames from the embedded server and forwards them to
   the editor, with one intercept:
   - `textDocument/publishDiagnostics` notifications get ttsc plugin
     diagnostics for the same URI appended into the same array.
3. Folds clean shutdown (`ErrFrameClosed`, `context.Canceled`,
   `io.ErrClosedPipe`) into a nil return so the editor sees a normal
   exit when it closes the LSP connection.

The JS launcher (`packages/ttsc/src/launcher/ttscserver.ts`) resolves the
platform binary the same way `ttsc` resolves its helper binary, then
spawns it with `--stdio` and inherited stdio.

## CLI usage

```
ttscserver --stdio
ttscserver --version
ttscserver --help
```

Options forwarded to the native host:

| Flag | Default | Purpose |
| --- | --- | --- |
| `--stdio` | required | Communicate with the editor over stdin/stdout. |
| `--cwd <dir>` | process cwd | Project root passed to the embedded tsgo server. |
| `--progress-delay <duration>` | `250ms` | Delay before tsgo shows its progress UI. |

## Editor wiring

Editors should spawn `node node_modules/ttsc/lib/launcher/ttscserver.js`
(or `npx ttscserver`) with stdio inherited. The launcher resolves the
native binary from the platform `@ttsc/<os>-<arch>` package.

For VSCode, the workspace ships [`packages/vscode-ttsc`](../packages/vscode-ttsc/)
which wires `vscode-languageclient` to ttscserver and surfaces the
ttsc-owned commands in the command palette.

## Plugin contribution surface

ttscserver embeds a `driver.PluginSource` that contributes:

- `Diagnostics(doc LSPDocumentVersion) []LSPDiagnostic` — appended to
  upstream `textDocument/publishDiagnostics`. `LSPDocumentVersion`
  carries the URI and the optional LSP `version`, so a plugin that
  caches in-flight work can drop stale findings.
- `CodeActions(uri, range, ctx) []LSPCodeAction` — appended to
  `textDocument/codeAction` responses.
- `ExecuteCommand(command, args) (*LSPWorkspaceEdit, error)` — handles
  ttsc-owned commands locally; the returned `LSPWorkspaceEdit` is
  embedded in the LSP response so the editor can apply it client-side.
- `CommandIDs() []string` — declares which command ids ttsc handles.

The default binary ships with `NullPluginSource{}`; the same proxy
exposes a clean seam for downstream embeddings (e.g. the lint/format
pipeline) to register their own source in a later release.

## Public Go surface (server entry points)

| Symbol | Purpose |
| --- | --- |
| `RunLSPServer(ctx, opts)` | Top-level entry — runs the embedded tsgo server + the proxy. |
| `LSPServerOptions` | Wire-up struct: In/Out/Err/Cwd/Source/ProgressDelay. |
| `ErrLSPCwdRequired` | Returned when Cwd is empty (tsgo would panic otherwise). |
| `ErrLSPUpstreamPanic` | Wraps a panic recovered from inside the embedded tsgo server. |
| `RecoverPanicAs(fn)` | Helper for downstream LSP-host embeddings that want the same panic→error contract. (Catches panics; not `runtime.Goexit`.) |
| `DenyNpmInstall` | NpmInstall callback that refuses all npm operations under an editor. |
| `WithUpstreamRunnerForTest` | Test-only seam to substitute the upstream runner. |
| `ErrFrameClosed`, `ErrFrameTooLarge` | Frame-reader sentinels (clean EOF / Content-Length over `MaxFrameBytes`). |
| `MaxFrameBytes` | 64 MiB cap on inbound frames to defend against runaway peers. |
| `ErrInvalidJSONRPC` | Envelope sentinel for `jsonrpc` ≠ `"2.0"`. |

The proxy also handles `$/cancelRequest` notifications by dropping any
pending codeAction entry whose id the editor cancelled. The
notification still flows to upstream so tsgo can clean up its own
in-flight work.

## Public Go surface (PluginSource API)

These types are what downstream plugin pipelines (lint, format,
third-party check plugins) implement to feed contributions into the
proxy.

| Symbol | Purpose |
| --- | --- |
| `PluginSource` | Interface a plugin pipeline implements: `Diagnostics`, `CodeActions`, `ExecuteCommand`, `CommandIDs`. |
| `NullPluginSource` | Zero-contribution implementation used when ttscserver is hosted without a pipeline. |
| `ErrCommandNotHandled` | Return value from `PluginSource.ExecuteCommand` that tells the proxy to forward the request upstream. |
| `NewProxy(opts)` | Low-level constructor downstream embeddings use to host the proxy without the full `RunLSPServer` flow. |
| `ProxyOptions` | Wiring for `NewProxy` — editor stdio + the upstream pipes the embedding owns. |
| `LSPDocumentVersion` | Argument to `Diagnostics`: URI + optional LSP version, so plugins can drop stale findings. |
| `LSPDiagnostic`, `LSPDiagnosticSeverity*` | LSP `Diagnostic` shape (and the standard severity constants `Error`/`Warning`/`Information`/`Hint`). |
| `LSPRange`, `LSPPosition` | LSP `Range` / `Position` shapes used by every position-anchored type. |
| `LSPCodeAction`, `LSPCodeActionContext`, `LSPCommand` | Code action result + context shapes. |
| `LSPWorkspaceEdit`, `LSPTextEdit` | WorkspaceEdit returned from `PluginSource.ExecuteCommand`; the proxy emits it inline in the executeCommand response so the editor can apply it client-side. |

## Architecture diagram

```
  +----------+      stdio      +-------------+      io.Pipe      +-------------+
  |  editor  | <-------------> | ttscserver  | <---------------> | tsgo lsp    |
  +----------+   JSON-RPC      | (proxy)     |   JSON-RPC bytes  | (embedded)  |
                               +------+------+                   +-------------+
                                      |
                                      v
                              driver.PluginSource
                              (lint/format/...)
```

## Files

- `packages/ttsc/cmd/ttscserver/` — Go binary entry (flag parsing, dispatch).
- `packages/ttsc/driver/lsp_*.go` — framing, envelope parsing, proxy, pluginsource, server wiring.
- `packages/ttsc/shim/lsp/` — hand-maintained shim over `internal/lsp`.
- `packages/ttsc/src/launcher/ttscserver.ts` — JS launcher (resolve + spawn).
- `packages/ttsc/test/driver/lsp_*_test.go` — Go-side proxy unit tests (frame, envelope, plugin, proxy, server).
- `packages/ttsc/test/ttscserver/` — black-box command tests (flag parsing, cwd resolution, stdio shutdown).
- `packages/vscode-ttsc/` — editor extension.
- `tests/test-ttsc/src/features/ttscserver/` — end-to-end LSP handshake tests.

## Testing

The Go-side proxy is unit tested under
`packages/ttsc/test/driver/lsp_*_test.go`; every code path the proxy
takes (forwarding, diagnostic merging, code action augmentation,
executeCommand dispatch, malformed-frame fallthrough, write-error
propagation) is pinned with one test per file. End-to-end stdio LSP
handshake tests live under
`tests/test-ttsc/src/features/ttscserver/`.
