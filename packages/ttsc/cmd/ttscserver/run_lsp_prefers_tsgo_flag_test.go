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
// @evidence contracts/testing.md#distinguishing-cases The flag path is separate from the environment fallback covered by its sibling test.
// @evidence contracts/testing.md#execution-ownership TestRunLSPPrefersTsgoFlag is a Go unit test in the cmd/ttscserver package: it calls runLSP in-process with the runLSPServer or getwd seam replaced and captured streams, starting neither tsgo nor a product process.
func TestRunLSPPrefersTsgoFlag(t *testing.T) {
  const expected = "/tmp/tsgo-test-binary"
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
    if code := runLSP([]string{"--stdio", "--cwd", t.TempDir(), "--tsgo", expected}); code != 0 {
      t.Fatalf("expected exit 0, got %d (stderr=%q)", code, errBuf.String())
    }
  })

  if captured.TsgoBinary != expected {
    t.Fatalf("expected TsgoBinary %q, got %q", expected, captured.TsgoBinary)
  }
}
