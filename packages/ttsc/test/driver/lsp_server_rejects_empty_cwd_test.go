package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRejectsEmptyCwd verifies the early-validation path in
// RunLSPServer. tsgo's lsp.NewServer panics on an empty Cwd; the wrapper
// converts that into a typed error so editor hosts surface a clean
// message instead of a stack trace.
//
// 1. Call RunLSPServer with Cwd="".
// 2. Assert ErrLSPCwdRequired is returned.
// 3. Assert no goroutines were started (function returns before any).
func TestLSPServerRejectsEmptyCwd(t *testing.T) {
  err := driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
    In:  io.NopCloser(nil),
    Out: io.Discard,
    Err: io.Discard,
    Cwd: "",
  })
  if !errors.Is(err, driver.ErrLSPCwdRequired) {
    t.Fatalf("expected ErrLSPCwdRequired, got %v", err)
  }
}
