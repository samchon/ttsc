package driver_test

import (
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPWriteFramePropagatesBodyWriteError Verifies the second leg of
// the writer error path. the header succeeded but the body write fails.
// Without this branch the proxy would silently truncate outbound frames.
//
// The independently counted 21-byte header succeeds before the four-byte body fails.
//
// 1. Configure a writer that fails after the header bytes have been written.
// 2. Assert WriteFrame returns a wrapped body-write error.
//
// @evidence contracts/testing.md#behavioral-verification WriteFrame wraps the injected failure with a body-write message.
// @evidence contracts/testing.md#independent-expectations The independently counted 21-byte header succeeds before the four-byte body fails.
// @evidence contracts/testing.md#distinguishing-cases Header-success/body-failure isolates the second write branch.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the actual frame writer with an injected in-memory byte-counting writer; no temporary file, shim compiler, host artifact or process transport is used.
func TestLSPWriteFramePropagatesBodyWriteError(t *testing.T) {
  sentinel := errors.New("body broken")
  // "Content-Length: 4\r\n\r\n" is 21 bytes; fail after them so only the
  // body Write call sees the sentinel error.
  w := newFlakyWriter(21, sentinel)

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
