package driver_test

import (
  "strings"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyAugmentedCodeActionDoesNotBlockUpstreamPump verifies slow plugin
// augmentation does not block later upstream notifications.
//
// For normal codeAction requests, ttsc waits for tsgo's response and appends
// plugin actions. That append work must not hold the upstream pump, or a slow
// plugin would delay unrelated TypeScript-Go diagnostics and notifications.
//
// 1. Send a normal codeAction request through to upstream.
// 2. Reply from upstream while plugin CodeActions is blocked.
// 3. Send upstream publishDiagnostics before releasing CodeActions.
// 4. Assert publishDiagnostics reaches the editor first.
func TestLSPProxyAugmentedCodeActionDoesNotBlockUpstreamPump(t *testing.T) {
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

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":9,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[]}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":9,"result":[{"title":"Add import","kind":"quickfix"}]}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("plugin code action augmentation did not start")
  }
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///b.ts","diagnostics":[]}}`))
  body := h.recvEditor()
  if !strings.Contains(string(body), "publishDiagnostics") {
    t.Fatalf("upstream pump was blocked by plugin code action, got:\n%s", body)
  }
  close(release)
  body = h.recvEditor()
  if !strings.Contains(string(body), "Add import") || !strings.Contains(string(body), "ttsc fix") {
    t.Fatalf("codeAction response was not eventually augmented:\n%s", body)
  }
}
