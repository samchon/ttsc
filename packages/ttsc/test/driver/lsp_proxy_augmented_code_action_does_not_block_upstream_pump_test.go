package driver_test

import (
  "encoding/json"
  "strings"
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyAugmentedCodeActionDoesNotBlockUpstreamPump Verifies slow plugin
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
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards diagnostics during blocked augmentation and later returns both actions.
// @evidence contracts/testing.md#independent-expectations A release channel holds plugin work unfinished while the authored notification must arrive first.
// @evidence contracts/testing.md#distinguishing-cases Blocked plugin work, unrelated notification progress and eventual completion are distinguished.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyAugmentedCodeActionDoesNotBlockUpstreamPump in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyAugmentedCodeActionDoesNotBlockUpstreamPump(t *testing.T) {
  started := make(chan struct{})
  release := make(chan struct{})
  var releaseCallbackOnce sync.Once
  releaseCallback := func() { releaseCallbackOnce.Do(func() { close(release) }) }
  t.Cleanup(releaseCallback)
  defer releaseCallback()
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
  var notification struct {
    Method string `json:"method"`
    Params struct {
      URI string `json:"uri"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &notification); err != nil {
    t.Fatalf("notification is not JSON: %v", err)
  }
  if notification.Method != "textDocument/publishDiagnostics" || notification.Params.URI != "file:///b.ts" {
    t.Fatalf("unrelated notification was not forwarded before release:\n%s", body)
  }
  releaseCallback()
  body = h.recvEditor()
  if !strings.Contains(string(body), "Add import") || !strings.Contains(string(body), "ttsc fix") {
    t.Fatalf("codeAction response was not eventually augmented:\n%s", body)
  }
  var response struct {
    ID     int `json:"id"`
    Result []struct {
      Title string `json:"title"`
    } `json:"result"`
  }
  if err := json.Unmarshal(body, &response); err != nil {
    t.Fatalf("augmented response is not JSON: %v", err)
  }
  if response.ID != 9 || len(response.Result) != 2 || response.Result[0].Title != "Add import" || response.Result[1].Title != "ttsc fix" {
    t.Fatalf("augmented action membership or response identity lost:\n%s", body)
  }
}
