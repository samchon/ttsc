package driver_test

import (
  "bytes"
  "errors"
  "io"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderPropagatesBodyReadError verifies that a truncated
// body (Content-Length larger than the remaining stream) surfaces a
// wrapped io.ErrUnexpectedEOF instead of returning a short body or
// silently looping.
//
// 1. Announce a 50-byte body but only send 4 bytes.
// 2. Assert Read errors with a wrapped unexpected EOF.
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
