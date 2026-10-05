package driver_test

import (
  "bytes"
  "errors"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderReadsWellFormedFrames Verifies the happy-path framing
// loop that the proxy depends on for every editor-side message.
//
// FrameReader.Read returns the header block and body separately so the
// proxy can preserve vendor headers; this test pins both surfaces in one
// place. The trailing clean-EOF assertion checks ErrFrameClosed for this
// finite byte stream, without executing proxy goroutine shutdown.
//
//  1. Concatenate two well-formed frames with extra Content-Type headers.
//  2. Drain the stream until ErrFrameClosed.
//  3. Assert both bodies are returned exactly, the first header block still
//     contains its Content-Type and Content-Length lines, and the third read
//     reports ErrFrameClosed.
//
// @evidence contracts/testing.md#behavioral-verification FrameReader.Read returns two literal bodies, retains the exact first header block including vendor value, then reports ErrFrameClosed.
// @evidence contracts/testing.md#independent-expectations Authored Content-Length-framed bytes establish both body contents and the clean end-of-stream expectation without using WriteFrame to generate the oracle.
// @evidence contracts/testing.md#distinguishing-cases Two consecutive frames, a vendor header and terminal clean EOF distinguish consumption, byte preservation and end-of-stream classification.
// @evidence contracts/testing.md#execution-ownership The Go test/driver framing unit reads a bytes.Reader directly without starting a product transport.
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
  if headers != "Content-Length: 7\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n" {
    t.Fatalf("first header block mismatch: %q", headers)
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
