package main

import (
  "bytes"
  "context"
  "os"
  "path/filepath"
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
//  1. Set the legacy TTSC_LSP_PLUGINS_JSON fallback to a valid manifest.
//  2. Substitute runLSPServer and capture its LSPServerOptions.
//  3. Run `ttscserver --stdio` and assert the native source is selected.
//  4. Put a valid manifest in TTSC_LSP_PLUGINS_FILE while making the legacy
//     environment payload invalid.
//  5. Run again and prove the bounded file transport takes precedence.
func TestRunLSPUsesNativePluginManifestSource(t *testing.T) {
  t.Setenv("TTSC_LSP_PLUGINS_JSON", `{"plugins":[],"lspPlugins":[]}`)
  t.Setenv("TTSC_LSP_PLUGINS_FILE", "")

  prev := runLSPServer
  var captured lspserver.LSPServerOptions
  runLSPServer = func(_ context.Context, opts lspserver.LSPServerOptions) error {
    captured = opts
    return nil
  }
  defer func() { runLSPServer = prev }()

  run := func(label string) {
    t.Helper()
    outBuf := &bytes.Buffer{}
    errBuf := &bytes.Buffer{}
    withIO(t, outBuf, errBuf, nil, func() {
      if code := runLSP([]string{
        "--stdio",
        "--cwd",
        t.TempDir(),
        "--tsconfig",
        "tsconfig.app.json",
      }); code != 0 {
        t.Fatalf("%s: expected exit 0, got %d (stderr=%q)", label, code, errBuf.String())
      }
    })
    if _, ok := captured.Source.(*lspserver.NativePluginSource); !ok {
      t.Fatalf("%s: expected NativePluginSource, got %T", label, captured.Source)
    }
  }
  run("legacy JSON")

  manifestFile := filepath.Join(t.TempDir(), "plugins.json")
  if err := os.WriteFile(
    manifestFile,
    []byte(`{"plugins":[],"lspPlugins":[]}`),
    0o600,
  ); err != nil {
    t.Fatal(err)
  }
  t.Setenv("TTSC_LSP_PLUGINS_JSON", "{invalid")
  t.Setenv("TTSC_LSP_PLUGINS_FILE", manifestFile)
  run("manifest file")
}
