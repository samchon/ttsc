package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsPendingOnNormalizedCancelID Verifies the shared id
// normalizer between handleCodeActionRequest and
// forgetCancelledRequest. A cancel arriving with id `1.0` must drop
// the pending entry stored under id `1`. otherwise
// peers that disagree on numeric encoding leak pending entries across
// every cancelled codeAction request.
//
// Numerically equal JSON-RPC ids correlate; authored response bytes are the pass-through oracle.
//
// 1. Forward a codeAction request with id 1.
// 2. Forward cancellation with numerically equal id 1.0.
// 3. Send the upstream response and require unchanged unaugmented bytes.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run cancels id 1 with id 1.0 and forwards the unaugmented response.
// @evidence contracts/testing.md#independent-expectations Numerically equal JSON-RPC ids correlate; authored response bytes are the pass-through oracle.
// @evidence contracts/testing.md#distinguishing-cases Integer request and differently spelled float cancellation are exercised in this direction.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyClearsPendingOnNormalizedCancelID in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyClearsPendingOnNormalizedCancelID(t *testing.T) {
  source := &stubSource{actions: []driver.LSPCodeAction{{Title: "should-not-appear"}}}
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":1,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("request not forwarded:\n%s", got)
  }

  cancel := []byte(`{"jsonrpc":"2.0","method":"$/cancelRequest","params":{"id":1.0}}`)
  h.sendEditor(cancel)
  if got := h.recvUpstream(); !bytes.Equal(got, cancel) {
    t.Fatalf("cancel not forwarded:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":1,"result":[{"title":"only-upstream"}]}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("response was augmented despite normalized cancel:\n%s", got)
  }
}
