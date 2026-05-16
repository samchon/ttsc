package driver_test

import (
  "bytes"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderRejectsMissingContentLength verifies the protocol
// contract: every LSP frame must declare a Content-Length so the body
// boundary is unambiguous.
//
// This also covers the parseContentLength branches that do not match the
// expected header — a header without a colon and one with a non-matching
// name both reach Read but neither contributes a length, so Read must
// surface the missing-header failure cleanly.
//
// 1. Send a frame with only a colonless line and an unrelated header.
// 2. Assert the resulting error explicitly mentions Content-Length.
func TestLSPFrameReaderRejectsMissingContentLength(t *testing.T) {
  body := []byte("NoColonHeaderLine\r\nContent-Type: application/json\r\n\r\n{}")
  fr := driver.NewFrameReader(bytes.NewReader(body))

  _, _, err := fr.Read()
  if err == nil {
    t.Fatal("expected missing-Content-Length error")
  }
  if !strings.Contains(err.Error(), "Content-Length") {
    t.Fatalf("error should mention Content-Length: %v", err)
  }
}
