package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRoutesAdvertisedCustomCodeActionKindLocally verifies custom
// plugin-only codeAction requests bypass upstream when the plugin advertised
// their kind.
//
// The initialize response advertises `PluginSource.CodeActionKinds()` to the
// editor. A later `context.only` request for one of those kinds belongs to the
// plugin even when tsgo also has a generic codeAction provider, so forwarding
// can delay or replace the requested plugin action.
//
// 1. Initialize with upstream `codeActionProvider: true`.
// 2. Configure a plugin source that advertises a custom source action kind.
// 3. Request only that custom kind.
// 4. Assert the proxy answers locally without forwarding upstream.
func TestLSPProxyRoutesAdvertisedCustomCodeActionKindLocally(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    actions: []driver.LSPCodeAction{{
      Title: "Custom source action",
      Kind:  "source.custom.ttsc",
      Command: &driver.LSPCommand{
        Title:   "Custom source action",
        Command: "ttsc.custom",
      },
    }},
    codeActionKinds: []string{"source.custom.ttsc"},
    commands:        []string{"ttsc.custom"},
  })
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":true}}}`))
  _ = h.recvEditor()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.custom.ttsc"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  body := h.recvEditor()
  var decoded struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, body)
  }
  if len(decoded.Result) != 1 || decoded.Result[0].Title != "Custom source action" {
    t.Fatalf("custom plugin-only response mismatch: %#v", decoded.Result)
  }
}
