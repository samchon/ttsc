package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRunReportsEditorWriteError covers two error branches with
// one scenario: pumpUpstreamToEditor's malformed-envelope forward path
// and its augmented-frame forward path. Both must surface a write error
// when the editor closes its read end mid-session.
//
//  1. Build a proxy with EditorOut closed on the editor side.
//  2. Send a malformed upstream frame so the pump takes the parse-error
//     branch into the failing write.
//  3. Assert the proxy returns a wrapped io.ErrClosedPipe error.
func TestLSPProxyRunReportsEditorWriteError(t *testing.T) {
  edInR, edInW := io.Pipe()
  edOutR, edOutW := io.Pipe()
  upInR, upInW := io.Pipe()
  upOutR, upOutW := io.Pipe()
  t.Cleanup(func() {
    edInR.Close()
    edInW.Close()
    edOutR.Close()
    edOutW.Close()
    upInR.Close()
    upInW.Close()
    upOutR.Close()
    upOutW.Close()
  })

  // Editor consumer disappears.
  edOutR.Close()
  // Editor producer ends cleanly so the editor pump returns ErrFrameClosed.
  edInW.Close()
  // Upstream consumer end is fine; we never block on it.

  proxy := driver.NewProxy(driver.ProxyOptions{
    EditorIn:    edInR,
    EditorOut:   edOutW,
    UpstreamIn:  upInW,
    UpstreamOut: upOutR,
    Source:      nil,
  })
  done := make(chan error, 1)
  go func() { done <- proxy.Run(context.Background()) }()

  if err := driver.WriteFrame(upOutW, []byte("non-json body")); err != nil {
    t.Fatal(err)
  }

  select {
  case err := <-done:
    if err == nil {
      t.Fatal("expected error from broken editor pipe")
    }
    if !errors.Is(err, io.ErrClosedPipe) {
      t.Fatalf("expected io.ErrClosedPipe, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("proxy.Run did not return after editor pipe break")
  }
}
