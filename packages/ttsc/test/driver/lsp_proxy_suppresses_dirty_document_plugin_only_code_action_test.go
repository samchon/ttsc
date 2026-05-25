package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesDirtyDocumentPluginOnlyCodeAction verifies source
// actions are not computed from saved disk text for dirty documents.
//
// Plugin-only source actions have no useful upstream fallback. Returning the
// saved-file action for a dirty buffer can apply edits to the wrong offsets, so
// the proxy answers with an empty result while the document is dirty.
//
// 1. Mark a document dirty with didChange.
// 2. Request a ttsc-only source action for that URI.
// 3. Assert the request is local, empty, and not forwarded upstream.
func TestLSPProxySuppressesDirtyDocumentPluginOnlyCodeAction(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    actions:  []driver.LSPCodeAction{{Title: "Fix all", Kind: "source.fixAll.ttsc"}},
    commands: []string{"ttsc.lint.fixAll"},
  })

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty = 1;"}]}}`))
  _ = h.recvUpstream()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.fixAll.ttsc"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  body := h.recvEditor()
  var decoded struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, body)
  }
  if len(decoded.Result) != 0 {
    t.Fatalf("dirty plugin-only actions were not suppressed: %#v", decoded.Result)
  }
}
