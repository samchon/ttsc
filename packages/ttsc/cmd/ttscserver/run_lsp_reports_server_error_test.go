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
// runLSP. When RunLSPServer reports a real failure (the upstream server
// crashed, an unrecoverable IO error, etc.) the launcher must exit 1
// and copy the error message to stderr.
//
// 1. Substitute the runLSPServer seam to return a sentinel error.
// 2. Run runLSP with --stdio --cwd <tempdir>.
// 3. Assert exit 1 and the sentinel text on stderr.
//
// @evidence contracts/testing.md#behavioral-verification runLSP exits with status 1 and prints the host's error text to stderr when the LSP host fails.
// @evidence contracts/testing.md#independent-expectations Status 1 and the sentinel error text are literals returned by the substituted runLSPServer.
// @evidence contracts/testing.md#distinguishing-cases A real failure contrasts with the cancellation and clean-exit paths covered by sibling tests.
// @evidence contracts/testing.md#execution-ownership TestRunLSPReportsServerError is a Go unit test in the cmd/ttscserver package: it calls runLSP in-process with the runLSPServer or getwd seam replaced and captured streams, starting neither tsgo nor a product process.
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
