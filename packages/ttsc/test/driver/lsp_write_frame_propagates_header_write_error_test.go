package driver_test

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPWriteFramePropagatesHeaderWriteError Verifies that a writer
// which fails before the body is reached produces a wrapped header-write
// error. The proxy treats this as fatal and tears down the pump.
//
// 1. Pass a writer that always fails on the first byte.
// 2. Assert WriteFrame returns the wrapped header-write error.
//
// @evidence contracts/testing.md#behavioral-verification WriteFrame returns an error wrapping the injected sentinel and mentioning header when the first write fails.
// @evidence contracts/testing.md#independent-expectations The independent flaky writer fails before any bytes, so the operation must report the header phase with the original cause.
// @evidence contracts/testing.md#distinguishing-cases A zero-byte allowance owns header failure; body-write failure and valid framing are covered by other cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver calls the actual frame writer with an injected in-memory writer, without a process transport.
func TestLSPWriteFramePropagatesHeaderWriteError(t *testing.T) {
  sentinel := errors.New("write failed")
  w := newFlakyWriter(0, sentinel)

  err := driver.WriteFrame(w, []byte("body"))
  if err == nil {
    t.Fatal("expected error from failing writer")
  }
  if !errors.Is(err, sentinel) {
    t.Fatalf("expected wrapped sentinel, got %v", err)
  }
  if !strings.Contains(err.Error(), "header") {
    t.Fatalf("error should mention header: %v", err)
  }
}
