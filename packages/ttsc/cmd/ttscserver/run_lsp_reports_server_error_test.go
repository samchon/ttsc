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
