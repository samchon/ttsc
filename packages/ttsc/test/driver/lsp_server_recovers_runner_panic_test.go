package driver_test

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerRecoversRunnerPanic Verifies panic conversion by the direct helper.
//
// RecoverPanicAs returns the upstream panic sentinel and message. This case
// does not execute the production runner and cannot detect removal of its
// recovery call.
//
// 1. Invoke the helper with a callback that panics with synthetic panic.
// 2. Require ErrLSPUpstreamPanic wrapping and the original panic message.
//
// @evidence contracts/testing.md#behavioral-verification RecoverPanicAs returns an error wrapping ErrLSPUpstreamPanic and carrying the literal synthetic panic message.
// @evidence contracts/testing.md#independent-expectations A panic must become the documented typed failure with its diagnostic value, not success or an unrelated error.
// @evidence contracts/testing.md#distinguishing-cases One callback panic owns conversion; this direct helper test cannot detect deletion of the production runner call to RecoverPanicAs.
// @evidence contracts/testing.md#execution-ownership Go test/driver directly invokes the panic conversion helper in process; it does not start RunLSPServer or a native upstream.
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
