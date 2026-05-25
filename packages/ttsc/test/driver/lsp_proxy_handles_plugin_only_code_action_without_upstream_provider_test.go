package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyHandlesPluginOnlyCodeActionWithoutUpstreamProvider verifies
// plugin-only codeAction requests stay local without upstream support.
//
// This keeps plugin actions usable without introducing a short timeout that can
// race and drop slow upstream TypeScript actions.
//
// 1. Initialize with `codeActionProvider: false`.
// 2. Send a source.fixAll.ttsc codeAction request.
// 3. Assert it is not forwarded upstream and the editor receives the plugin action.
func TestLSPProxyHandlesPluginOnlyCodeActionWithoutUpstreamProvider(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    actions:  []driver.LSPCodeAction{{Title: "Fix all", Kind: "source.fixAll.ttsc"}},
    commands: []string{"ttsc.lint.fixAll"},
  })
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":false}}}`))
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
