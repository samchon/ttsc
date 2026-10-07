package driver_test

import (
  "bytes"
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderRejectsOversizeHeader Verifies that FrameReader reports ErrFrameTooLarge for oversized headers with and without a newline.
//
// Inputs with and without a later newline both exceed the streaming header cap;
// this does not establish two different rejection branches.
//
// 1. Feed a frame with a header line larger than MaxHeaderBytes.
// 2. Assert Read returns ErrFrameTooLarge.
// 3. Repeat without a terminating newline to pin the streaming cap path.
//
// @evidence contracts/testing.md#behavioral-verification FrameReader reports ErrFrameTooLarge for oversized headers with and without a newline.
// @evidence contracts/testing.md#independent-expectations The public MaxHeaderBytes bound and errors.Is identity establish independent expectations.
// @evidence contracts/testing.md#distinguishing-cases A later newline versus no newline supplies two over-cap inputs; rejection can occur before that terminator in the same streaming-cap branch.
// @evidence contracts/testing.md#execution-ownership Two in-memory readers exercise the Go header parser without transport processes. Go discovers TestLSPFrameReaderRejectsOversizeHeader under ./test/driver.
func TestLSPFrameReaderRejectsOversizeHeader(t *testing.T) {
  frame := []byte(
    "X-Long: " + strings.Repeat("x", driver.MaxHeaderBytes+1) +
      "\r\nContent-Length: 2\r\n\r\n{}",
  )
  fr := driver.NewFrameReader(bytes.NewReader(frame))

  _, _, err := fr.Read()
  if !errors.Is(err, driver.ErrFrameTooLarge) {
    t.Fatalf("expected ErrFrameTooLarge, got %v", err)
  }

  noNewline := []byte("X-Long: " + strings.Repeat("x", driver.MaxHeaderBytes+1))
  fr = driver.NewFrameReader(bytes.NewReader(noNewline))

  _, _, err = fr.Read()
  if !errors.Is(err, driver.ErrFrameTooLarge) {
    t.Fatalf("expected ErrFrameTooLarge for unterminated header, got %v", err)
  }
}
