package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderAcceptsCaseInsensitiveHeader Verifies that FrameReader accepts lowercase content-length and returns hello.
//
// Lowercase recognition is covered; invalid lengths have separate entries.
//
// 1. Build a frame with a lowercase content-length header.
// 2. Assert Read parses the body without error.
//
// @evidence contracts/testing.md#behavioral-verification FrameReader accepts lowercase content-length and returns hello.
// @evidence contracts/testing.md#independent-expectations LSP header names are case-insensitive, and the authored body is five bytes.
// @evidence contracts/testing.md#distinguishing-cases Lowercase recognition is covered; invalid lengths have separate entries.
// @evidence contracts/testing.md#execution-ownership NewFrameReader consumes a bytes.Reader directly in Go without a server. Go discovers TestLSPFrameReaderAcceptsCaseInsensitiveHeader under ./test/driver.
func TestLSPFrameReaderAcceptsCaseInsensitiveHeader(t *testing.T) {
  body := []byte("content-length: 5\r\n\r\nhello")
  fr := driver.NewFrameReader(bytes.NewReader(body))

  _, payload, err := fr.Read()
  if err != nil {
    t.Fatalf("Read errored: %v", err)
  }
  if string(payload) != "hello" {
    t.Fatalf("body mismatch: %q", payload)
  }
}
