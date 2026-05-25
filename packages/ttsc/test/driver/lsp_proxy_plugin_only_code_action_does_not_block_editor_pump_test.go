package driver_test

import (
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyPluginOnlyCodeActionDoesNotBlockEditorPump verifies slow plugin
// code actions run off the editor pump.
//
// Plugin-only requests are handled locally, but a cold sidecar may still take
// seconds to answer. The proxy must continue forwarding unrelated editor
// notifications to upstream while that request is pending.
//
// 1. Block the plugin CodeActions callback.
// 2. Send a plugin-only codeAction request.
// 3. Send didOpen while CodeActions is blocked.
// 4. Assert didOpen reaches upstream before the codeAction is released.
func TestLSPProxyPluginOnlyCodeActionDoesNotBlockEditorPump(t *testing.T) {
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

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":8,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.fixAll.ttsc"]}}}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("plugin code action did not start")
  }
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///b.ts","version":1,"languageId":"typescript","text":"export {};"}}}`))
  body := h.recvUpstream()
  if string(body) == "" || !called.Load() {
    t.Fatalf("didOpen was not forwarded while plugin code action was pending: %s", body)
  }
  close(release)
  _ = h.recvEditor()
}
