package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPWriteFrameRoundTripsWithReader Verifies that WriteFrame and FrameReader round-trip the body and retain Content-Length.
//
// One JSON body is round-tripped; literal-frame reader tests supply independent framing inputs.
//
// 1. Write a JSON body through WriteFrame.
// 2. Read it back via FrameReader.
// 3. Assert the bodies match and the header block carries Content-Length.
//
// @evidence contracts/testing.md#behavioral-verification WriteFrame and FrameReader round-trip the body and retain Content-Length.
// @evidence contracts/testing.md#independent-expectations The authored payload independently specifies the body, but the same implementation pair can share a framing error; exact wire length is not asserted.
// @evidence contracts/testing.md#distinguishing-cases One JSON body is round-tripped; literal-frame reader tests supply independent framing inputs.
// @evidence contracts/testing.md#execution-ownership Both public Go operations use one bytes.Buffer without stdio peers. Go discovers TestLSPWriteFrameRoundTripsWithReader under ./test/driver.
func TestLSPWriteFrameRoundTripsWithReader(t *testing.T) {
  var buf bytes.Buffer
  payload := []byte(`{"jsonrpc":"2.0","method":"ping"}`)
  if err := driver.WriteFrame(&buf, payload); err != nil {
    t.Fatalf("WriteFrame errored: %v", err)
  }

  fr := driver.NewFrameReader(&buf)
  headers, body, err := fr.Read()
  if err != nil {
    t.Fatalf("Read after write errored: %v", err)
  }
  if !bytes.Equal(body, payload) {
    t.Fatalf("body round-trip mismatch:\ngot:  %q\nwant: %q", body, payload)
  }
  if !bytes.Contains([]byte(headers), []byte("Content-Length:")) {
    t.Fatalf("header block missing Content-Length: %q", headers)
  }
}
