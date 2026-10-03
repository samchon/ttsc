package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRejectsEmptyCwd Verifies that RunLSPServer rejects empty Cwd with ErrLSPCwdRequired.
//
// Rejection precedes reading deliberately unusable input; valid Cwd is exercised elsewhere.
//
// 1. Call RunLSPServer with Cwd="".
// 2. Assert ErrLSPCwdRequired is returned.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer rejects empty Cwd with ErrLSPCwdRequired.
// @evidence contracts/testing.md#independent-expectations The public required-working-directory precondition establishes the sentinel.
// @evidence contracts/testing.md#distinguishing-cases Rejection precedes reading deliberately unusable input; valid Cwd is exercised elsewhere.
// @evidence contracts/testing.md#execution-ownership This Go entry calls the public early validation path directly without starting a runner. Go discovers TestLSPServerRejectsEmptyCwd under ./test/driver.
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
