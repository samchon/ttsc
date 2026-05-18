package driver_test

import (
	"bytes"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderReportsHeaderReadErrors locks the failure mode the
// proxy relies on to surface broken peers: a partial header block must
// produce a wrapped error rather than silently truncate.
//
// The proxy distinguishes between "stream ended cleanly between frames"
// (ErrFrameClosed) and "stream ended mid-header" (wrapped error) when
// deciding whether to forward shutdown to the upstream tsgo server.
//
// 1. Feed a header line without the terminating empty line.
// 2. Assert Read returns a wrapped header-read error.
// 3. Confirm the error is not ErrFrameClosed so the pump treats it as fatal.
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
