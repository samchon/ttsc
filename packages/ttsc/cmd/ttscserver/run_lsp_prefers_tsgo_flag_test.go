package main

import (
  "bytes"
  "context"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestRunLSPPrefersTsgoFlag verifies the native command forwards an explicit
// upstream tsgo path into the LSP host options.
//
// Editors normally enter through the JavaScript launcher, but direct native
// callers can pass --tsgo. This pins that flag path separately from the
// TTSC_TSGO_BINARY environment fallback.
//
// 1. Substitute the runLSPServer seam and capture its options.
// 2. Run runLSP with --stdio, --cwd, and --tsgo.
// 3. Assert the captured TsgoBinary is the flag value.
//
// @evidence contracts/testing.md#behavioral-verification runLSP forwards an explicit --tsgo path into LSPServerOptions.TsgoBinary.
// @evidence contracts/testing.md#independent-expectations The expected path is the literal constant the test passes.
// @evidence contracts/testing.md#distinguishing-cases A distinct literal environment path competes with the explicit flag path, so ignoring the flag or preferring the environment is detected.
// @evidence contracts/testing.md#execution-ownership This Go unit captures the owning runLSPServer seam and package-level writers. Plugin file/JSON environment transports are cleared with restoring controls before source construction, so no plugin query or host process starts. Flag and environment binary paths remain opaque option data.
func TestRunLSPPrefersTsgoFlag(t *testing.T) {
  const expected = "/tmp/tsgo-test-binary"
  t.Setenv("TTSC_TSGO_BINARY", "/tmp/tsgo-environment-binary")
  t.Setenv("TTSC_LSP_PLUGINS_FILE", "")
  t.Setenv("TTSC_LSP_PLUGINS_JSON", "")
  prev := runLSPServer
  var captured lspserver.LSPServerOptions
  runLSPServer = func(_ context.Context, opts lspserver.LSPServerOptions) error {
    captured = opts
    return nil
  }
  defer func() { runLSPServer = prev }()

  outBuf := &bytes.Buffer{}
  errBuf := &bytes.Buffer{}
  expectedCwd := t.TempDir()
  withIO(t, outBuf, errBuf, nil, func() {
    if code := runLSP([]string{"--stdio", "--cwd", expectedCwd, "--tsgo", expected}); code != 0 {
      t.Fatalf("expected exit 0, got %d (stderr=%q)", code, errBuf.String())
    }
  })

  if captured.TsgoBinary != expected {
    t.Fatalf("expected TsgoBinary %q, got %q", expected, captured.TsgoBinary)
  }
  if captured.Cwd != expectedCwd { t.Fatalf("expected explicit cwd %q, got %q", expectedCwd, captured.Cwd) }
}
