package driver_test

import (
  "bytes"
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderReadsWellFormedFrames verifies the happy-path framing
// loop that the proxy depends on for every editor-side message.
//
// FrameReader.Read returns the header block and body separately so the
// proxy can preserve vendor headers; this test pins both surfaces in one
// place. The trailing clean-EOF assertion confirms that streams terminate
// with ErrFrameClosed instead of a generic io.EOF, which is how the
// proxy goroutines decide they can shut down without raising an alarm.
//
// 1. Concatenate two well-formed frames with extra Content-Type headers.
// 2. Drain the stream until ErrFrameClosed.
// 3. Assert the body bytes and the header block are returned losslessly.
func TestLSPFrameReaderReadsWellFormedFrames(t *testing.T) {
  first := []byte("Content-Length: 7\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{\"a\":1}")
  second := []byte("Content-Length: 7\r\n\r\n{\"b\":2}")
  fr := driver.NewFrameReader(bytes.NewReader(append(first, second...)))

  headers, body, err := fr.Read()
  if err != nil {
    t.Fatalf("first read errored: %v", err)
  }
  if string(body) != `{"a":1}` {
    t.Fatalf("first body mismatch: %q", body)
  }
  if !strings.Contains(headers, "Content-Type:") {
    t.Fatalf("first headers lost vendor header: %q", headers)
  }
  if !strings.Contains(headers, "Content-Length: 7") {
    t.Fatalf("first headers lost length: %q", headers)
  }

  _, body, err = fr.Read()
  if err != nil {
    t.Fatalf("second read errored: %v", err)
  }
  if string(body) != `{"b":2}` {
    t.Fatalf("second body mismatch: %q", body)
  }

  _, _, err = fr.Read()
  if !errors.Is(err, driver.ErrFrameClosed) {
    t.Fatalf("expected ErrFrameClosed, got %v", err)
  }
}
