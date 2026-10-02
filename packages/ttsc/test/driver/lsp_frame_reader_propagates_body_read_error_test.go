package driver_test

import (
  "bytes"
  "errors"
  "io"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderPropagatesBodyReadError Verifies that a truncated
// body (Content-Length larger than the remaining stream) surfaces a
// wrapped io.ErrUnexpectedEOF instead of returning a short body or
// silently looping.
//
// Advertised fifty bytes exceed the authored four-byte payload.
//
// 1. Announce a 50-byte body but only send 4 bytes.
// 2. Assert Read errors with a wrapped unexpected EOF.
//
// @evidence contracts/testing.md#behavioral-verification FrameReader.Read wraps io.ErrUnexpectedEOF for a truncated body.
// @evidence contracts/testing.md#independent-expectations Advertised fifty bytes exceed the authored four-byte payload.
// @evidence contracts/testing.md#distinguishing-cases Complete header with incomplete body differs from header truncation.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPFrameReaderPropagatesBodyReadError is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestLSPFrameReaderPropagatesBodyReadError(t *testing.T) {
  frame := []byte("Content-Length: 50\r\n\r\nabcd")
  fr := driver.NewFrameReader(bytes.NewReader(frame))

  _, _, err := fr.Read()
  if err == nil {
    t.Fatal("expected error on truncated body")
  }
  if !errors.Is(err, io.ErrUnexpectedEOF) {
    t.Fatalf("expected wrapped io.ErrUnexpectedEOF, got %v", err)
  }
}
