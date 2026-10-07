package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRunReportsMalformedEditorForwardError Verifies
// pumpEditorToUpstream's malformed-envelope forward branch: when a
// non-JSON frame from the editor must be forwarded to a broken upstream
// pipe, the proxy returns the wrapped write error.
//
// 1. Close the upstream consumer end before traffic starts.
// 2. Close the upstream producer so the second pump returns cleanly.
// 3. Send a non-JSON editor frame (parse fails, then write fails).
// 4. Assert Proxy.Run returns a wrapped io.ErrClosedPipe.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns a wrapped io.ErrClosedPipe when forwarding a non-JSON editor frame to a closed upstream consumer.
// @evidence contracts/testing.md#independent-expectations Malformed envelope bytes still take the forwarding path; the independently closed pipe establishes the failure oracle.
// @evidence contracts/testing.md#distinguishing-cases A non-JSON body and broken upstream writer own this error branch while the sibling upstream producer is closed to drain the run.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the proxy directly over controlled pipe endpoints without starting a TypeScript-Go process.
func TestLSPProxyRunReportsMalformedEditorForwardError(t *testing.T) {
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

  if err := driver.WriteFrame(edInW, []byte("not json")); err != nil {
    t.Fatal(err)
  }

  select {
  case err := <-done:
    if err == nil {
      t.Fatal("expected error from broken upstream pipe")
    }
    if !errors.Is(err, io.ErrClosedPipe) {
      t.Fatalf("expected io.ErrClosedPipe, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("proxy.Run did not return after upstream pipe break")
  }
}
