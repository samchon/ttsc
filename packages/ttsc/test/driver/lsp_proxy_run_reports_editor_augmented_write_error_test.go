package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRunReportsEditorAugmentedWriteError covers the
// augmented-write branch of pumpUpstreamToEditor: a valid envelope
// gets through augmentUpstream and then the editor pipe write fails.
// This is the path that fires for the common cases (publishDiagnostics,
// codeAction responses) so it must surface the error cleanly.
//
// 1. Build a proxy with the editor consumer closed.
// 2. Send a valid (parseable) upstream notification.
// 3. Assert Proxy.Run returns a wrapped io.ErrClosedPipe.
func TestLSPProxyRunReportsEditorAugmentedWriteError(t *testing.T) {
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

  edOutR.Close()
  edInW.Close()

  proxy := driver.NewProxy(driver.ProxyOptions{
    EditorIn:    edInR,
    EditorOut:   edOutW,
    UpstreamIn:  upInW,
    UpstreamOut: upOutR,
    Source:      nil,
  })
  done := make(chan error, 1)
  go func() { done <- proxy.Run(context.Background()) }()

  if err := driver.WriteFrame(upOutW, []byte(`{"jsonrpc":"2.0","method":"window/logMessage","params":{}}`)); err != nil {
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
