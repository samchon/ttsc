package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyAugmentsNullCodeActionResponse pins the null-result branch
// of the code-action augment path. Upstream commonly returns null when
// it has no actions for a range; ttsc must still attach its own actions
// in that case so the editor gets a meaningful response.
//
// 1. Configure a source with one code action.
// 2. Forward a codeAction request and drain it upstream.
// 3. Reply from upstream with result=null.
// 4. Assert the editor sees an array containing only the plugin action.
func TestLSPProxyAugmentsNullCodeActionResponse(t *testing.T) {
  source := &stubSource{
    actions: []driver.LSPCodeAction{{Title: "format", Kind: "source.format"}},
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":13,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  _ = h.recvUpstream()

  upstreamResp := []byte(`{"jsonrpc":"2.0","id":13,"result":null}`)
  h.sendUpstream(upstreamResp)
  body := h.recvEditor()

  var decoded struct {
    Result []json.RawMessage `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("response body not JSON: %v\n%s", err, body)
  }
  if got := len(decoded.Result); got != 1 {
    t.Fatalf("expected 1 action, got %d in %s", got, body)
  }
}
