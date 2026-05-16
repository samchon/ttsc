package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderAcceptsCaseInsensitiveHeader pins the case-insensitive
// match required by the LSP base protocol so editors that downcase
// headers (notably some legacy adapters) still hand framed messages to
// the proxy.
//
// 1. Build a frame with a lowercase content-length header.
// 2. Assert Read parses the body without error.
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
