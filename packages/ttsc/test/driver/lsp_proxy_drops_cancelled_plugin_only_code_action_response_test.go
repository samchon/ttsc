package driver_test

import (
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsCancelledPluginOnlyCodeActionResponse Verifies local source
// actions honor request cancellation.
//
// Plugin-only code actions are handled locally instead of being forwarded to
// upstream tsgo. A later `$/cancelRequest` must therefore clear the local
// pending entry too, otherwise the proxy can still write an editor response for
// a cancelled request.
//
// 1. Start a plugin-only codeAction request and block the plugin callback.
// 2. Send `$/cancelRequest` for that request id.
// 3. Release the plugin callback.
// 4. Assert no editor response is written.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run sends no local action response during 150ms after cancellation and release.
// @evidence contracts/testing.md#independent-expectations The cancel id matches the blocked local request independently of plugin output.
// @evidence contracts/testing.md#distinguishing-cases Local-only cancellation is covered; arbitrarily late responses are not ruled out.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyDropsCancelledPluginOnlyCodeActionResponse in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyDropsCancelledPluginOnlyCodeActionResponse(t *testing.T) {
  started := make(chan struct{})
  release := make(chan struct{})
  var releaseCallbackOnce sync.Once
  releaseCallback := func() { releaseCallbackOnce.Do(func() { close(release) }) }
  t.Cleanup(releaseCallback)
  defer releaseCallback()
  var called atomic.Bool
  source := &stubSource{
    actionsWithContext: func(uri string, ctx driver.LSPCodeActionContext) []driver.LSPCodeAction {
      if uri == "file:///a.ts" && len(ctx.Only) == 1 {
        if called.CompareAndSwap(false, true) {
          close(started)
        }
        <-release
      }
      return []driver.LSPCodeAction{{Title: "ttsc fix", Kind: "source.fixAll.ttsc"}}
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":10,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.fixAll.ttsc"]}}}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("plugin code action did not start")
  }
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"$/cancelRequest","params":{"id":10}}`))
  _ = h.recvUpstream()
  releaseCallback()
  h.expectNoEditorFrame(150 * time.Millisecond)
}
