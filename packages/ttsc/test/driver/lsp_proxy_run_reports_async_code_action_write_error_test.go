package driver_test

import (
  "context"
  "errors"
  "io"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRunReportsAsyncCodeActionWriteError verifies async code-action
// augmentation write failures still terminate the proxy run.
//
// Forwarded code-action responses are completed from a goroutine after plugin
// actions are computed. A broken editor output pipe during that callback must be
// reported through `Proxy.Run`, not silently dropped.
//
// 1. Start a proxy with plugin code actions blocked.
// 2. Forward a codeAction request and upstream response.
// 3. Close the editor output reader before releasing the plugin callback.
// 4. Assert `Proxy.Run` returns the pipe write error.
func TestLSPProxyRunReportsAsyncCodeActionWriteError(t *testing.T) {
  release := make(chan struct{})
  source := &stubSource{
    actionsWithContext: func(string, driver.LSPCodeActionContext) []driver.LSPCodeAction {
      <-release
      return []driver.LSPCodeAction{{Title: "plugin", Kind: "source.fixAll.ttsc"}}
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
  proxy := driver.NewProxy(driver.ProxyOptions{
    EditorIn:    edInR,
    EditorOut:   edOutW,
    UpstreamIn:  upInW,
    UpstreamOut: upOutR,
    Source:      source,
  })
  done := make(chan error, 1)
  go func() { done <- proxy.Run(context.Background()) }()

  if err := driver.WriteFrame(edInW, []byte(`{"jsonrpc":"2.0","id":1,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[]}}}`)); err != nil {
    t.Fatal(err)
  }
  frUp := driver.NewFrameReader(upInR)
  if _, _, err := frUp.Read(); err != nil {
    t.Fatal(err)
  }
  if err := driver.WriteFrame(upOutW, []byte(`{"jsonrpc":"2.0","id":1,"result":[]}`)); err != nil {
    t.Fatal(err)
  }
  edOutR.Close()
  close(release)

  select {
  case err := <-done:
    if err == nil {
      t.Fatal("expected async code action write error")
    }
    if !errors.Is(err, io.ErrClosedPipe) {
      t.Fatalf("expected io.ErrClosedPipe, got %v", err)
    }
  case <-time.After(3 * time.Second):
    t.Fatal("proxy.Run did not return after async code action write error")
  }
}
