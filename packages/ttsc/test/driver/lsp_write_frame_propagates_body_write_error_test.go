package driver_test

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPWriteFramePropagatesBodyWriteError verifies the second leg of
// the writer error path — the header succeeded but the body write fails.
// Without this branch the proxy would silently truncate outbound frames.
//
// 1. Configure a writer that fails after the header bytes have been written.
// 2. Assert WriteFrame returns a wrapped body-write error.
func TestLSPWriteFramePropagatesBodyWriteError(t *testing.T) {
  sentinel := errors.New("body broken")
  // Content-Length: 4\r\n\r\n is 22 bytes; fail after them so only the
  // body Write call sees the sentinel error.
  w := newFlakyWriter(22, sentinel)

  err := driver.WriteFrame(w, []byte("data"))
  if err == nil {
    t.Fatal("expected error from body write")
  }
  if !errors.Is(err, sentinel) {
    t.Fatalf("expected wrapped sentinel, got %v", err)
  }
  if !strings.Contains(err.Error(), "body") {
    t.Fatalf("error should mention body: %v", err)
  }
}
