package driver_test

import (
  "encoding/json"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsAugmentedCodeActionAfterDocumentClose verifies forwarded
// codeAction augmentation is invalidated by didClose.
//
// Normal codeAction requests wait for tsgo's response and then append plugin
// actions asynchronously. The proxy must recheck that the document generation
// still matches immediately after plugin work, otherwise a late plugin action
// can be spliced into an upstream response for a closed buffer.
//
// 1. Send a normal codeAction request through to upstream.
// 2. Reply from upstream while plugin CodeActions is blocked.
// 3. Send didClose for the same URI.
// 4. Release the plugin and assert only the upstream action is returned.
func TestLSPProxyDropsAugmentedCodeActionAfterDocumentClose(t *testing.T) {
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

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":13,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[]}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":13,"result":[{"title":"Add import","kind":"quickfix"}]}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("plugin code action augmentation did not start")
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
  if len(decoded.Result) != 1 || decoded.Result[0].Title != "Add import" {
    t.Fatalf("closed-document augmentation was not dropped: %#v", decoded.Result)
  }
}
