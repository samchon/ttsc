package driver_test

import (
  "bytes"
  "errors"
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderRejectsOversizeContentLength Verifies refusal of an oversized frame.
//
// A peer that announces a Content-Length above the
// proxy's safety cap must produce a typed error rather than driving the
// reader to allocate the full announced size before the body even
// arrives.
//
// 1. Feed a header whose Content-Length exceeds MaxFrameBytes.
// 2. Assert Read returns ErrFrameTooLarge.
//
// @evidence contracts/testing.md#behavioral-verification FrameReader.Read rejects a header announcing MaxFrameBytes plus one with ErrFrameTooLarge before any body is supplied.
// @evidence contracts/testing.md#independent-expectations The public frame size limit defines the boundary, and errors.Is checks the typed refusal rather than a platform-dependent message.
// @evidence contracts/testing.md#distinguishing-cases Only the first value above the cap is tested here; valid bodies and other malformed headers have separate framing cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the actual reader on an in-memory header, with no child or allocation-sized fixture body.
func TestLSPFrameReaderRejectsOversizeContentLength(t *testing.T) {
  oversize := int64(driver.MaxFrameBytes) + 1
  header := []byte(fmt.Sprintf("Content-Length: %d\r\n\r\n", oversize))
  fr := driver.NewFrameReader(bytes.NewReader(header))

  _, _, err := fr.Read()
  if !errors.Is(err, driver.ErrFrameTooLarge) {
    t.Fatalf("expected ErrFrameTooLarge, got %v", err)
  }
}
