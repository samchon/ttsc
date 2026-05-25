package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRoutesPluginOnlyCodeActionLocally verifies source-only plugin
// action requests bypass upstream even when upstream advertises code actions.
//
// Editors send `context.only` when a user invokes a source action such as
// fix-all. That request belongs to ttsc's sidecar, and forwarding it to tsgo can
// hang or return irrelevant TypeScript actions before the plugin action is
// available.
//
// 1. Initialize with upstream `codeActionProvider: true`.
// 2. Send a source.fixAll.ttsc codeAction request.
// 3. Assert the proxy answers from the plugin source without forwarding.
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
