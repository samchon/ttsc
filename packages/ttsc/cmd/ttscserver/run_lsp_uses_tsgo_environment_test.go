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
// The JavaScript launcher passes its selected upstream binary through this
// environment variable. This unit treats the sentinel as opaque option data;
// executable discovery, existence and child execution are not tested.
//
// 1. Set TTSC_TSGO_BINARY to a sentinel path.
// 2. Substitute runLSPServer and capture its options.
// 3. Assert TsgoBinary is populated from the environment.
//
// @evidence contracts/testing.md#behavioral-verification runLSP fills LSPServerOptions.TsgoBinary from TTSC_TSGO_BINARY when no --tsgo flag is given.
// @evidence contracts/testing.md#independent-expectations The expected path is the literal sentinel set in the environment.
// @evidence contracts/testing.md#distinguishing-cases The environment fallback contrasts with the explicit flag covered by its sibling test.
// @evidence contracts/testing.md#execution-ownership This Go unit restores its authored environment sentinel, replaces the owning runLSPServer seam, and captures package-owned writers. Both plugin-manifest environment transports are cleared before source construction, so no plugin query or host process starts. It does not replace getwd or foreign process streams.
func TestRunLSPUsesTsgoEnvironment(t *testing.T) {
  const expected = "/tmp/tsgo-env-binary"
  t.Setenv("TTSC_TSGO_BINARY", expected)
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
  withIO(t, outBuf, errBuf, nil, func() {
    if code := runLSP([]string{"--stdio", "--cwd", t.TempDir()}); code != 0 {
      t.Fatalf("expected exit 0, got %d (stderr=%q)", code, errBuf.String())
    }
  })

  if captured.TsgoBinary != expected {
    t.Fatalf("expected TsgoBinary %q, got %q", expected, captured.TsgoBinary)
  }
}
