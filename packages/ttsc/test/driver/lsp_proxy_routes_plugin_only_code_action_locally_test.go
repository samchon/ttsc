package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRoutesPluginOnlyCodeActionLocally Verifies a local plugin-only answer and no upstream frame within 150ms even when upstream advertises actions.
//
// The advertised-provider case complements the no-provider initialization entry.
//
// 1. Initialize with upstream `codeActionProvider: true`.
// 2. Send a source.fixAll.ttsc codeAction request.
// 3. Observe the plugin source answer and no upstream frame within 150ms.
//
// @evidence contracts/testing.md#behavioral-verification The explicit plugin-only request receives the authored local action and no upstream frame within 150ms despite advertised upstream support.
// @evidence contracts/testing.md#independent-expectations The explicit source.fixAll.ttsc filter and authored title establish local ownership and result.
// @evidence contracts/testing.md#distinguishing-cases The advertised-provider case complements the no-provider initialization entry.
// @evidence contracts/testing.md#execution-ownership Initialize and action share one Go proxy harness checking local response and upstream silence. Go discovers TestLSPProxyRoutesPluginOnlyCodeActionLocally under ./test/driver.
func TestLSPProxyRoutesPluginOnlyCodeActionLocally(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    actions:  []driver.LSPCodeAction{{Title: "Fix all", Kind: "source.fixAll.ttsc"}},
    commands: []string{"ttsc.lint.fixAll"},
  })
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":true}}}`))
  _ = h.recvEditor()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.fixAll.ttsc"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  body := h.recvEditor()
  var decoded struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, body)
  }
  if len(decoded.Result) != 1 || decoded.Result[0].Title != "Fix all" {
    t.Fatalf("plugin-only response mismatch: %#v", decoded.Result)
  }
}
