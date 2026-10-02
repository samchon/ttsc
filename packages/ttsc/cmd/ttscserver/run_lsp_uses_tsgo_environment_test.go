package main

import (
  "bytes"
  "context"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestRunLSPUsesTsgoEnvironment verifies TTSC_TSGO_BINARY feeds the native host
// when no --tsgo flag is present.
//
// The JavaScript launcher resolves typescript and passes the
// absolute path through this environment variable, keeping the Go binary thin
// and independent of Node's module resolver.
//
// 1. Set TTSC_TSGO_BINARY to a sentinel path.
// 2. Substitute runLSPServer and capture its options.
// 3. Assert TsgoBinary is populated from the environment.
//
// @evidence contracts/testing.md#behavioral-verification runLSP fills LSPServerOptions.TsgoBinary from TTSC_TSGO_BINARY when no --tsgo flag is given.
// @evidence contracts/testing.md#independent-expectations The expected path is the literal sentinel set in the environment.
// @evidence contracts/testing.md#distinguishing-cases The environment fallback contrasts with the explicit flag covered by its sibling test.
// @evidence contracts/testing.md#execution-ownership TestRunLSPUsesTsgoEnvironment is a Go unit test in the cmd/ttscserver package: it calls runLSP in-process with the runLSPServer or getwd seam replaced and captured streams, starting neither tsgo nor a product process.
func TestRunLSPUsesTsgoEnvironment(t *testing.T) {
  const expected = "/tmp/tsgo-env-binary"
  t.Setenv("TTSC_TSGO_BINARY", expected)

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
    if code := runLSP([]string{"--stdio", "--cwd", t.TempDir()}); code != 0 {
      t.Fatalf("expected exit 0, got %d (stderr=%q)", code, errBuf.String())
    }
  })

  if captured.TsgoBinary != expected {
    t.Fatalf("expected TsgoBinary %q, got %q", expected, captured.TsgoBinary)
  }
}
