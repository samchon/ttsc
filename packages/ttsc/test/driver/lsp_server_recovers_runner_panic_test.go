package driver_test

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRecoversRunnerPanic pins the panic-recovery seam used by
// defaultUpstreamRunner. Calling RecoverPanicAs directly exercises the
// same code path the production runner installs, so a future refactor
// that deletes the defer-recover block would turn this test red.
//
// 1. Call RecoverPanicAs with a function that panics with a known message.
// 2. Assert the returned error wraps ErrLSPUpstreamPanic.
// 3. Assert the panic value flows into the error string for diagnostics.
func TestLSPServerRecoversRunnerPanic(t *testing.T) {
  err := driver.RecoverPanicAs(func() error {
    panic("synthetic panic")
  })
  if !errors.Is(err, driver.ErrLSPUpstreamPanic) {
    t.Fatalf("expected ErrLSPUpstreamPanic, got %v", err)
  }
  if !strings.Contains(err.Error(), "synthetic panic") {
    t.Fatalf("expected panic value in error, got %q", err)
  }
}
