package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyAugmentsCodeActionResponse verifies the bookkeeping that
// pairs an editor codeAction request with the upstream response so ttsc
// can append plugin-owned actions. The proxy must remember the request
// uri/range/context when forwarding and then attach actions when the
// matching response arrives.
//
// 1. Configure a source that contributes one code action.
// 2. Send a codeAction request from the editor.
// 3. Drain the forwarded request from upstream.
// 4. Reply from upstream with a single existing action.
// 5. Assert the editor sees a merged array containing both actions.
func TestLSPProxyAugmentsCodeActionResponse(t *testing.T) {
  source := &stubSource{
    actions: []driver.LSPCodeAction{
      {
        Title:   "Apply ttsc lint fix",
        Kind:    "quickfix",
        Command: &driver.LSPCommand{Title: "ttsc.lint.fix", Command: "ttsc.lint.fix"},
      },
    },
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":11,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":1,"character":0},"end":{"line":1,"character":5}},"context":{"diagnostics":[]}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); string(got) != string(request) {
    t.Fatalf("upstream did not see codeAction request:\n%s", got)
  }

  upstreamResp := []byte(`{"jsonrpc":"2.0","id":11,"result":[{"title":"Add import","kind":"quickfix"}]}`)
  h.sendUpstream(upstreamResp)
  body := h.recvEditor()

  if !strings.Contains(string(body), "Add import") {
    t.Fatalf("upstream action lost:\n%s", body)
  }
  if !strings.Contains(string(body), "Apply ttsc lint fix") {
    t.Fatalf("plugin action missing:\n%s", body)
  }
  var decoded struct {
    Result []json.RawMessage `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("merged code action body not JSON: %v", err)
  }
  if got := len(decoded.Result); got != 2 {
    t.Fatalf("expected 2 actions, got %d in %s", got, body)
  }
}
