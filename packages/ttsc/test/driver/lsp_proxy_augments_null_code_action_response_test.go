package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyAugmentsNullCodeActionResponse Verifies the null-result branch
// of the code-action augment path. Upstream commonly returns null when
// it has no actions for a range; ttsc must still attach its own actions
// in that case so the editor gets a meaningful response.
//
// 1. Configure a source with one code action.
// 2. Forward a codeAction request and drain it upstream.
// 3. Reply from upstream with result=null.
// 4. Assert the editor sees an array of one element; action fields are not checked.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run converts a correlated upstream null result into an array of one element when the plugin supplies an action.
// @evidence contracts/testing.md#independent-expectations Null upstream actions leave room for the one authored plugin action; this body asserts result length, not the action fields.
// @evidence contracts/testing.md#distinguishing-cases The null-to-singleton branch is owned here; populated upstream arrays and silent sources are covered separately.
// @evidence contracts/testing.md#execution-ownership The Go test/driver unit uses the in-process proxy harness with a stub action source and literal request/response frames.
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
