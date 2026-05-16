package driver_test

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPWriteFramePropagatesHeaderWriteError verifies that a writer
// which fails before the body is reached produces a wrapped header-write
// error. The proxy treats this as fatal and tears down the pump.
//
// 1. Pass a writer that always fails on the first byte.
// 2. Assert WriteFrame returns the wrapped header-write error.
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
