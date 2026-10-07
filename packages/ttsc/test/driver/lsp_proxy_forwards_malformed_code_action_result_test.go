package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsMalformedCodeActionResult Verifies that an action result of 42 forwards unchanged rather than being augmented.
//
// A valid remembered request is paired with a wrong-shaped result.
//
// 1. Configure a source that would contribute an action.
// 2. Send a codeAction request, forward it upstream.
// 3. Reply from upstream with a scalar `"result": 42` that cannot be an action array.
// 4. Assert the editor sees the original (non-augmented) response.
//
// @evidence contracts/testing.md#behavioral-verification An action result of 42 forwards unchanged rather than being augmented.
// @evidence contracts/testing.md#independent-expectations A scalar is not an LSP action array; the authored response bytes define safe forwarding.
// @evidence contracts/testing.md#distinguishing-cases A valid remembered request is paired with a wrong-shaped result.
// @evidence contracts/testing.md#execution-ownership The Go pipe proxy receives authored frames and a source that would add an action if augmentation ran. Go discovers TestLSPProxyForwardsMalformedCodeActionResult under ./test/driver.
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
