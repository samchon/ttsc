package main

import (
  "bytes"
  "context"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestRunLSPUsesNativePluginManifestSource verifies the command wires the
// launcher-provided plugin manifest into the proxy source.
//
// A previous implementation always passed NullPluginSource, so editor sessions
// could never receive ttsc plugin diagnostics or commands. This test pins the
// command-level seam without starting tsgo: the JavaScript launcher owns plugin
// discovery, and the Go command must turn its manifest into a NativePluginSource.
//
// 1. Set TTSC_LSP_PLUGINS_JSON to an empty but valid manifest.
// 2. Substitute runLSPServer and capture its LSPServerOptions.
// 3. Run `ttscserver --stdio` against a temp cwd.
// 4. Assert Source is the native sidecar-backed implementation.
func TestRunLSPUsesNativePluginManifestSource(t *testing.T) {
  t.Setenv("TTSC_LSP_PLUGINS_JSON", `{"plugins":[],"lspPlugins":[]}`)

  prev := runLSPServer
  var captured lspserver.LSPServerOptions
  runLSPServer = func(_ context.Context, opts lspserver.LSPServerOptions) error {
    captured = opts
    return nil
  }
  defer func() { runLSPServer = prev }()

  outBuf := &bytes.Buffer{}
  errBuf := &bytes.Buffer{}
  withIO(t, outBuf, errBuf, nil, func() {
    if code := runLSP([]string{"--stdio", "--cwd", t.TempDir(), "--tsconfig", "tsconfig.app.json"}); code != 0 {
      t.Fatalf("expected exit 0, got %d (stderr=%q)", code, errBuf.String())
    }
  })

  if _, ok := captured.Source.(*lspserver.NativePluginSource); !ok {
    t.Fatalf("expected NativePluginSource, got %T", captured.Source)
  }
}
