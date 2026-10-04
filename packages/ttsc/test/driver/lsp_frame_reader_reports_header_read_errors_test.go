package driver_test

import (
  "bytes"
  "errors"
  "io"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderReportsHeaderReadErrors checks that a partial header
// produces a wrapped read error, distinct from ErrFrameClosed between
// frames. It does not execute proxy fatal handling or upstream shutdown.
//
// 1. Feed a header line without the terminating empty line.
// 2. Assert Read returns a wrapped header-read error.
// 3. Confirm the error is not ErrFrameClosed.
//
// @evidence contracts/testing.md#behavioral-verification FrameReader.Read wraps io.EOF as a header error instead of ErrFrameClosed.
// @evidence contracts/testing.md#independent-expectations Mid-header termination differs from clean closure between frames.
// @evidence contracts/testing.md#distinguishing-cases A partial CR-terminated header exercises header truncation distinct from clean closure and body truncation, without observing a transport's fatal handling.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the actual reader on bytes.Reader input and checks its error identity/text, without filesystem inputs, shim operations or a server process.
func TestLSPFrameReaderReportsHeaderReadErrors(t *testing.T) {
  partial := []byte("Content-Length: 4\r")
  fr := driver.NewFrameReader(bytes.NewReader(partial))

  _, _, err := fr.Read()
  if err == nil {
    t.Fatal("expected error from truncated header")
  }
  if errors.Is(err, driver.ErrFrameClosed) {
    t.Fatalf("truncated header must not look like a clean close: %v", err)
  }
  if !errors.Is(err, io.EOF) {
    t.Fatalf("expected wrapped io.EOF, got %v", err)
  }
  if !strings.Contains(err.Error(), "header") {
    t.Fatalf("error message should mention header: %v", err)
  }
}
