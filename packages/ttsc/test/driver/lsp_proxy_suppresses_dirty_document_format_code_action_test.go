package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesDirtyDocumentFormatCodeAction Verifies that dirty-document source.format requests return empty local actions and do not forward.
//
// didChange makes the document dirty before its source.format-only request.
//
// 1. Configure a plugin source that owns `ttsc.format.document`.
// 2. Mark a document dirty with didChange.
// 3. Request only `source.format` for that URI.
// 4. Assert the request is local, empty, and not forwarded upstream.
//
// @evidence contracts/testing.md#behavioral-verification Dirty-document source.format requests return empty local actions and do not forward.
// @evidence contracts/testing.md#independent-expectations A disk-based plugin action cannot safely target an unsaved generation.
// @evidence contracts/testing.md#distinguishing-cases didChange makes the document dirty before its source.format-only request.
// @evidence contracts/testing.md#execution-ownership A format-command-owning Go stub and pipe proxy exercise suppression without a formatter process. Go discovers TestLSPProxySuppressesDirtyDocumentFormatCodeAction under ./test/driver.
func TestLSPProxySuppressesDirtyDocumentFormatCodeAction(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    actions:  []driver.LSPCodeAction{{Title: "Format", Kind: "source.format"}},
    commands: []string{"ttsc.format.document"},
  })

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty = 1;"}]}}`))
  _ = h.recvUpstream()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.format"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  body := h.recvEditor()
  var decoded struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, body)
  }
  if len(decoded.Result) != 0 {
    t.Fatalf("dirty format actions were not suppressed: %#v", decoded.Result)
  }
}
