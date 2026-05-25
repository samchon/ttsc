package driver_test

import (
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsCancelledPluginOnlyCodeActionResponse verifies local source
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
func TestLSPProxyDropsCancelledPluginOnlyCodeActionResponse(t *testing.T) {
  started := make(chan struct{})
  release := make(chan struct{})
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
  close(release)
  h.expectNoEditorFrame(150 * time.Millisecond)
}
