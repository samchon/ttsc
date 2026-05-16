package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsMalformedCodeActionResult covers the
// appendCodeActions safety branch: when the upstream response body
// matches a remembered codeAction request id but its result is not a
// JSON array of actions, ttsc must forward the upstream response
// verbatim instead of erroring or silently dropping it.
//
// 1. Configure a source that would contribute an action.
// 2. Send a codeAction request, forward it upstream.
// 3. Reply from upstream with `"result": 42` (decode fails on append).
// 4. Assert the editor sees the original (non-augmented) response.
func TestLSPProxyForwardsMalformedCodeActionResult(t *testing.T) {
  source := &stubSource{
    actions: []driver.LSPCodeAction{{Title: "should-not-appear"}},
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":7,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("upstream did not see request:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":7,"result":42}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("response was augmented despite invalid result:\n%s", got)
  }
}
