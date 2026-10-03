package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsPendingOnNormalizedCancelIDReverseDirection Verifies that cancel ID 1 retires a request encoded as 1.0 so its later action response remains unchanged.
//
// Fractional request and integer cancel cover the reverse normalization direction.
//
// 1. Configure a source that would normally add an action.
// 2. Send request ID 1.0 and drain it upstream.
// 3. Send cancel ID 1, drain it, and deliver the response for ID 1.0.
// 4. Assert the editor receives the original response.
//
// @evidence contracts/testing.md#behavioral-verification Cancel ID 1 retires a request encoded as 1.0 so its later action response remains unchanged.
// @evidence contracts/testing.md#independent-expectations These exact safe numeric forms identify the same JSON-RPC request; original response bytes define forwarding.
// @evidence contracts/testing.md#distinguishing-cases Fractional request and integer cancel cover the reverse normalization direction.
// @evidence contracts/testing.md#execution-ownership The Go proxy harness drains request and cancel forwards before the synthetic response. Go discovers TestLSPProxyClearsPendingOnNormalizedCancelIDReverseDirection under ./test/driver.
func TestLSPProxyClearsPendingOnNormalizedCancelIDReverseDirection(t *testing.T) {
  source := &stubSource{actions: []driver.LSPCodeAction{{Title: "should-not-appear"}}}
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":1.0,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("request not forwarded:\n%s", got)
  }

  cancel := []byte(`{"jsonrpc":"2.0","method":"$/cancelRequest","params":{"id":1}}`)
  h.sendEditor(cancel)
  if got := h.recvUpstream(); !bytes.Equal(got, cancel) {
    t.Fatalf("cancel not forwarded:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":1.0,"result":[{"title":"only-upstream"}]}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("response was augmented despite normalized cancel:\n%s", got)
  }
}
