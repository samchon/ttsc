package main

import (
  "bytes"
  "context"
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestRunLSPReportsServerError pins the non-cancellation error path in
// runLSP. An authored sentinel from its owning host seam must produce exit 1
// and the error text on stderr. Actual upstream crashes and native IO failures
// are not exercised here.
//
// 1. Substitute the runLSPServer seam to return a sentinel error.
// 2. Run runLSP with --stdio --cwd <tempdir>.
// 3. Assert exit 1 and the sentinel text on stderr.
//
// @evidence contracts/testing.md#behavioral-verification runLSP exits with status 1 and prints the host's error text to stderr when the LSP host fails.
// @evidence contracts/testing.md#independent-expectations Status 1 and the sentinel error text are literals returned by the substituted runLSPServer.
// @evidence contracts/testing.md#distinguishing-cases The authored non-cancellation sentinel selects the failure branch; it does not simulate an actual upstream crash or IO fault.
// @evidence contracts/testing.md#execution-ownership This Go unit replaces the owning runLSPServer seam and captures package-owned writers. Restoring empty file/JSON plugin-manifest environment controls isolate source construction before that seam, so no plugin query or host process starts; foreign process methods and streams are unchanged.
func TestRunLSPReportsServerError(t *testing.T) {
  sentinel := errors.New("lsp host blew up")
  prev := runLSPServer
  runLSPServer = func(_ context.Context, _ lspserver.LSPServerOptions) error {
    return sentinel
  }
  defer func() { runLSPServer = prev }()

  outBuf := &bytes.Buffer{}
  errBuf := &bytes.Buffer{}
  withIO(t, outBuf, errBuf, nil, func() {
    if code := runLSP([]string{"--stdio", "--cwd", t.TempDir()}); code != 1 {
      t.Fatalf("expected exit 1, got %d", code)
    }
  })

  if !strings.Contains(errBuf.String(), sentinel.Error()) {
    t.Fatalf("expected sentinel on stderr, got: %q", errBuf.String())
  }
}
  t.Setenv("TTSC_LSP_PLUGINS_FILE", "")
  t.Setenv("TTSC_LSP_PLUGINS_JSON", "")
