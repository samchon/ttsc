package driver_test

import (
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsCancelledAugmentedCodeActionResponse verifies late
// cancellation still wins after upstream has answered.
//
// For normal codeAction requests, the proxy holds the upstream response while
// plugin actions are appended asynchronously. A cancellation that arrives in
// that window must prevent the held response from being written back with stale
// plugin actions.
//
// 1. Forward a codeAction request to upstream.
// 2. Send the upstream response while plugin CodeActions is blocked.
// 3. Cancel the request before releasing the plugin callback.
// 4. Assert no editor response is written.
func TestLSPProxyDropsCancelledAugmentedCodeActionResponse(t *testing.T) {
  started := make(chan struct{})
  release := make(chan struct{})
  var called atomic.Bool
  source := &stubSource{
    actionsWithContext: func(uri string, ctx driver.LSPCodeActionContext) []driver.LSPCodeAction {
      if uri == "file:///a.ts" && len(ctx.Only) == 0 {
        if called.CompareAndSwap(false, true) {
          close(started)
        }
        <-release
      }
      return []driver.LSPCodeAction{{Title: "ttsc fix", Kind: "source.fixAll.ttsc"}}
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":21,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[]}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":21,"result":[{"title":"Add import","kind":"quickfix"}]}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("plugin code action augmentation did not start")
  }

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"$/cancelRequest","params":{"id":21}}`))
  _ = h.recvUpstream()
  close(release)
  h.expectNoEditorFrame(150 * time.Millisecond)
}
