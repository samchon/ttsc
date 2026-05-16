package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsNonArrayCodeActionResult covers the result-shape
// guard in appendCodeActions. LSP allows editors to reuse ids after a
// response is observed — if the editor cancels a codeAction id and
// reuses it for a different method, the upstream response carries a
// non-array result. Without the guard the proxy would unmarshal that
// foreign result, prepend ttsc actions, and corrupt the answer.
//
// 1. Configure a source that would contribute an action.
// 2. Send a codeAction request and drain it upstream.
// 3. Reply with id-matching response whose result is an object (e.g. hover).
// 4. Assert the editor receives the object response unmodified.
func TestLSPProxyForwardsNonArrayCodeActionResult(t *testing.T) {
  source := &stubSource{actions: []driver.LSPCodeAction{{Title: "ignored"}}}
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":7,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  _ = h.recvUpstream()

  response := []byte(`{"jsonrpc":"2.0","id":7,"result":{"contents":"hover-text"}}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("non-array result was augmented:\n%s", got)
  }
}
