package driver_test

import (
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyPluginOnlyCodeActionDoesNotBlockEditorPump Verifies slow plugin
// code actions run off the editor pump.
//
// Plugin-only requests are handled locally, but a cold sidecar may still take
// seconds to answer. The proxy must continue forwarding unrelated editor
// notifications to upstream while that request is pending.
//
//  1. Block the plugin CodeActions callback.
//  2. Send a plugin-only codeAction request.
//  3. Send didOpen while CodeActions is blocked.
//  4. Assert a non-empty frame reaches upstream while the plugin callback is
//     still blocked (the frame's content is not inspected), then release it.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run starts the blocked plugin action callback and forwards a nonempty upstream frame before that callback is released.
// @evidence contracts/testing.md#independent-expectations Plugin action computation must leave the editor pump available; the channel barrier proves forwarding occurs during callback work.
// @evidence contracts/testing.md#distinguishing-cases A plugin-only action and subsequent didOpen own the blocked-computation interval; the body checks frame nonemptiness, not its method or URI.
// @evidence contracts/testing.md#execution-ownership Go test/driver uses the real pipe proxy with a channel-gated stub callback; no actual plugin producer is spawned.
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
  var releaseOnce sync.Once
  releaseCallback := func() { releaseOnce.Do(func() { close(release) }) }
  t.Cleanup(releaseCallback)

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
  releaseCallback()
  _ = h.recvEditor()
}
