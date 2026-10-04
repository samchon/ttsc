package driver_test

import (
  "context"
  "errors"
  "io"
  "sync"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRunReportsAsyncPluginDiagnosticsWriteError Verifies async plugin
// diagnostic publish failures still terminate the proxy run.
//
// Plugin diagnostics are written from a goroutine so upstream diagnostics can
// flow first. If the editor output pipe closes while the plugin callback is
// blocked, the resumed write must still be reported through `Proxy.Run`.
//
// 1. Start a proxy with a release-gated plugin diagnostic callback.
// 2. Trigger an upstream publish that schedules plugin diagnostics.
// 3. Close the editor output reader, then release the plugin callback.
// 4. Assert `Proxy.Run` returns the pipe write error.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns io.ErrClosedPipe when asynchronous diagnostics write after the editor reader closes.
// @evidence contracts/testing.md#independent-expectations The controlled closed pipe must surface as a run failure even though publication happens outside the upstream pump.
// @evidence contracts/testing.md#distinguishing-cases The upstream frame is drained, editor output closes and the plugin callback gate is released; callback-entry timing is not separately observed, and this case owns asynchronous write failure.
// @evidence contracts/testing.md#execution-ownership Go test/driver directly wires the real proxy to io.Pipe endpoints and a blocked diagnostic stub, with no producer process.
func TestLSPProxyRunReportsAsyncPluginDiagnosticsWriteError(t *testing.T) {
  release := make(chan struct{})
  source := &stubSource{
    diagnosticsFor: func(driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      <-release
      return []driver.LSPDiagnostic{{Source: "ttsc/lint", Message: "plugin"}}
    },
  }
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
  edInW.Close()

  proxy := driver.NewProxy(driver.ProxyOptions{
    EditorIn:    edInR,
    EditorOut:   edOutW,
    UpstreamIn:  upInW,
    UpstreamOut: upOutR,
    Source:      source,
  })
  done := make(chan error, 1)
  finished := make(chan struct{})
  go func() {
    defer close(finished)
    done <- proxy.Run(context.Background())
  }()
  t.Cleanup(func() {
    edInR.Close()
    edInW.Close()
    edOutR.Close()
    edOutW.Close()
    upInR.Close()
    upInW.Close()
    upOutR.Close()
    upOutW.Close()
    select {
    case <-finished:
    case <-time.After(3 * time.Second):
      t.Error("proxy.Run did not finish during cleanup")
    }
  })
  var releaseOnce sync.Once
  releaseCallback := func() { releaseOnce.Do(func() { close(release) }) }
  t.Cleanup(releaseCallback)

  if err := driver.WriteFrame(upOutW, []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","diagnostics":[]}}`)); err != nil {
    t.Fatal(err)
  }
  fr := driver.NewFrameReader(edOutR)
  if _, _, err := fr.Read(); err != nil {
    t.Fatal(err)
  }
  edOutR.Close()
  releaseCallback()

  select {
  case err := <-done:
    if err == nil {
      t.Fatal("expected async plugin diagnostic write error")
    }
    if !errors.Is(err, io.ErrClosedPipe) {
      t.Fatalf("expected io.ErrClosedPipe, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("proxy.Run did not return after async diagnostic write error")
  }
}
