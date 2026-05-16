package driver_test

import (
  "bytes"
  "encoding/json"
  "fmt"
  "testing"
)

// buildFrame produces a Content-Length-framed LSP wire message from the
// JSON body. Tests pass either pre-marshaled JSON or any struct/map; in
// the latter case the helper marshals it. This keeps individual test
// files focused on the assertion instead of repeating header math.
func buildFrame(t *testing.T, body any) []byte {
  t.Helper()
  var raw []byte
  switch v := body.(type) {
  case []byte:
    raw = v
  case string:
    raw = []byte(v)
  default:
    encoded, err := json.Marshal(body)
    if err != nil {
      t.Fatal(err)
    }
    raw = encoded
  }
  return append([]byte(fmt.Sprintf("Content-Length: %d\r\n\r\n", len(raw))), raw...)
}

// chainFrames concatenates many wire frames into a single byte stream
// for FrameReader tests that exercise multi-frame consumption.
func chainFrames(frames ...[]byte) []byte {
  var out bytes.Buffer
  for _, frame := range frames {
    out.Write(frame)
  }
  return out.Bytes()
}

// flakyWriter fails the configured byte boundary so write-error paths
// can be exercised without depending on filesystem or network state.
type flakyWriter struct {
  failAfter int
  written   int
  err       error
}

// newFlakyWriter returns a writer that succeeds for the first failAfter
// bytes and then returns the supplied error on every subsequent Write.
func newFlakyWriter(failAfter int, err error) *flakyWriter {
  return &flakyWriter{failAfter: failAfter, err: err}
}

func (w *flakyWriter) Write(p []byte) (int, error) {
  if w.written >= w.failAfter {
    return 0, w.err
  }
  remaining := w.failAfter - w.written
  if len(p) <= remaining {
    w.written += len(p)
    return len(p), nil
  }
  w.written += remaining
  return remaining, w.err
}
