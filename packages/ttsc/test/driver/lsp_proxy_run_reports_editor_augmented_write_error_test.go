package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRunReportsEditorAugmentedWriteError Verifies that Proxy.Run returns wrapped io.ErrClosedPipe when a valid notification writes to a closed editor output.
//
// A parseable envelope reaches the ordinary augmented write path; malformed frames are not this case.
//
// 1. Build a proxy with the editor consumer closed.
// 2. Send a valid (parseable) upstream notification.
// 3. Assert Proxy.Run returns a wrapped io.ErrClosedPipe.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns wrapped io.ErrClosedPipe when a valid notification writes to a closed editor output.
// @evidence contracts/testing.md#independent-expectations The closed pipe independently provides the standard error identity.
// @evidence contracts/testing.md#distinguishing-cases A parseable envelope reaches the ordinary augmented write path; malformed frames are not this case.
// @evidence contracts/testing.md#execution-ownership Private io.Pipe ends and direct Go Proxy.Run exercise the failure and join its result. Go discovers TestLSPProxyRunReportsEditorAugmentedWriteError under ./test/driver.
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
