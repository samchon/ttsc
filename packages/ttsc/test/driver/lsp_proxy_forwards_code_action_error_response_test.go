package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsCodeActionErrorResponse pins the safety guard in
// appendCodeActions: when upstream returns an `error` response for a
// remembered codeAction id, the proxy must NOT splice ttsc actions
// into the result field. JSON-RPC §5.1 forbids both `result` and
// `error` on the same frame and well-behaved editors reject such
// hybrid responses.
//
// 1. Configure a source that would otherwise contribute an action.
// 2. Send a codeAction request and drain it upstream.
// 3. Reply from upstream with an error envelope for the same id.
// 4. Assert the editor receives the original error response verbatim.
func TestLSPProxyForwardsCodeActionErrorResponse(t *testing.T) {
  source := &stubSource{
    actions: []driver.LSPCodeAction{{Title: "should-not-appear"}},
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":31,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("upstream did not see request:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":31,"error":{"code":-32603,"message":"upstream failed"}}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("error response was rewritten:\n%s", got)
  }
}
