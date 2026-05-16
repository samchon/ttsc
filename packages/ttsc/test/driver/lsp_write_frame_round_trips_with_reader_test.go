package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPWriteFrameRoundTripsWithReader pins the framing contract by
// piping a write through the matching reader and asserting bit-for-bit
// equivalence. This is the single sanity check that the proxy's outgoing
// writes will be parsed by any compliant LSP client (and by the matching
// FrameReader inside ttscserver).
//
// 1. Write a JSON body through WriteFrame.
// 2. Read it back via FrameReader.
// 3. Assert the bodies match and the header block carries Content-Length.
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
