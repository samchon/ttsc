package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRunReturnsUpstreamWriteError Verifies that Proxy.Run returns wrapped io.ErrClosedPipe when forwarding writes to a closed upstream consumer.
//
// The opposite upstream producer closes too, allowing its pump to end cleanly.
//
// 1. Build a proxy whose UpstreamIn reader is closed before any traffic.
// 2. Send a valid editor frame that the proxy will try to forward.
// 3. Close the upstream-to-editor side so the second pump returns cleanly.
// 4. Assert Proxy.Run returns a non-nil error wrapping io.ErrClosedPipe.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns wrapped io.ErrClosedPipe when forwarding writes to a closed upstream consumer.
// @evidence contracts/testing.md#independent-expectations The deliberately closed reader establishes the standard pipe failure independently of dispatch.
// @evidence contracts/testing.md#distinguishing-cases The opposite upstream producer closes too, allowing its pump to end cleanly.
// @evidence contracts/testing.md#execution-ownership The test's private pipes and direct Go proxy invocation exercise forwarding failure without a child. Go discovers TestLSPProxyRunReturnsUpstreamWriteError under ./test/driver.
func TestLSPProxyRunReturnsUpstreamWriteError(t *testing.T) {
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

  // Closing the upstream consumer immediately forces the proxy's
  // pumpEditorToUpstream to fail on its first WriteFrame.
  upInR.Close()
  // Closing the upstream producer makes the other pump return
  // ErrFrameClosed so Run does not wait forever.
  upOutW.Close()

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
