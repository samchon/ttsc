package driver_test

import (
  "encoding/json"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsPluginOnlyCodeActionAfterDocumentClose verifies local source
// actions cannot answer for a closed document.
//
// Plugin-only code actions run in a side goroutine so the editor pump can keep
// reading notifications. A close that arrives while the plugin is computing
// invalidates the request; otherwise ttsc can return command-backed actions for
// a buffer the editor has already discarded.
//
// 1. Start a plugin-only codeAction request and block the plugin callback.
// 2. Send didClose for the same URI while the callback is blocked.
// 3. Release the callback.
// 4. Assert the local response is empty, not the stale plugin action.
func TestLSPProxyDropsPluginOnlyCodeActionAfterDocumentClose(t *testing.T) {
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

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":12,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.fixAll.ttsc"]}}}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("plugin code action did not start")
  }

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didClose","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()
  close(release)

  body := h.recvEditor()
  var decoded struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, body)
  }
  if len(decoded.Result) != 0 {
    t.Fatalf("closed-document plugin actions were not dropped: %#v", decoded.Result)
  }
}
