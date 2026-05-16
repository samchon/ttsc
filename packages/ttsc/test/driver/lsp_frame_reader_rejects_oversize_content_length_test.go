package driver_test

import (
  "bytes"
  "errors"
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderRejectsOversizeContentLength pins the DoS hardening
// added in round 1. A peer that announces a Content-Length above the
// proxy's safety cap must produce a typed error rather than driving the
// reader to allocate the full announced size before the body even
// arrives.
//
// 1. Feed a header whose Content-Length exceeds MaxFrameBytes.
// 2. Assert Read returns ErrFrameTooLarge.
func TestLSPFrameReaderRejectsOversizeContentLength(t *testing.T) {
  oversize := int64(driver.MaxFrameBytes) + 1
  header := []byte(fmt.Sprintf("Content-Length: %d\r\n\r\n", oversize))
  fr := driver.NewFrameReader(bytes.NewReader(header))

  _, _, err := fr.Read()
  if !errors.Is(err, driver.ErrFrameTooLarge) {
    t.Fatalf("expected ErrFrameTooLarge, got %v", err)
  }
}
