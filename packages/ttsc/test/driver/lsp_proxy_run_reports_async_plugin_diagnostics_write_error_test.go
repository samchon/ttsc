package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRunReportsAsyncPluginDiagnosticsWriteError verifies async plugin
// diagnostic publish failures still terminate the proxy run.
//
// Plugin diagnostics are written from a goroutine so upstream diagnostics can
// flow first. If the editor output pipe closes while the plugin callback is
// blocked, the resumed write must still be reported through `Proxy.Run`.
//
// 1. Start a proxy with plugin diagnostics blocked.
// 2. Trigger an upstream publish that schedules plugin diagnostics.
// 3. Close the editor output reader, then release the plugin callback.
// 4. Assert `Proxy.Run` returns the pipe write error.
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
  go func() { done <- proxy.Run(context.Background()) }()

  if err := driver.WriteFrame(upOutW, []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","diagnostics":[]}}`)); err != nil {
    t.Fatal(err)
  }
  fr := driver.NewFrameReader(edOutR)
  if _, _, err := fr.Read(); err != nil {
    t.Fatal(err)
  }
  edOutR.Close()
  close(release)

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
