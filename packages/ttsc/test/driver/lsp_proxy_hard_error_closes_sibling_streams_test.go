package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyHardErrorClosesSiblingStreams verifies hard proxy errors drain both pumps.
//
// A write failure in one proxy pump used to require the test to pre-close the
// opposite stream. The proxy itself must close the sibling closeable endpoints
// so production pipe pairs cannot leave Run blocked forever after the first
// hard transport error.
//
// 1. Build a proxy whose upstream input reader is already closed.
// 2. Send one valid editor frame and leave the upstream-output writer open.
// 3. Assert Run returns the write error instead of waiting on the sibling pump.
func TestLSPProxyHardErrorClosesSiblingStreams(t *testing.T) {
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

  upInR.Close()

  proxy := driver.NewProxy(driver.ProxyOptions{
    EditorIn:    edInR,
    EditorOut:   edOutW,
    UpstreamIn:  upInW,
    UpstreamOut: upOutR,
    Source:      nil,
  })

  done := make(chan error, 1)
  go func() { done <- proxy.Run(context.Background()) }()

  if err := driver.WriteFrame(edInW, []byte(`{"jsonrpc":"2.0","method":"ping"}`)); err != nil {
    t.Fatal(err)
  }

  select {
  case err := <-done:
    if err == nil {
      t.Fatal("expected a non-nil error from broken upstream pipe")
    }
    if !errors.Is(err, io.ErrClosedPipe) {
      t.Fatalf("expected wrapped io.ErrClosedPipe, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("proxy.Run did not return after upstream pipe break")
  }
}
