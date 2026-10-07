package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySkipsCodeActionWithNonIDShape Verifies invalid JSON-RPC ids are
// not remembered for augmentation.
//
// LSP request ids may be strings or numbers. If an editor sends a non-id shape,
// IDKey returns the empty key; the proxy must treat that as "no pending entry"
// rather than storing pendingActions[""] and later augmenting unrelated frames.
//
// 1. Configure a source that would contribute a code action.
// 2. Send a codeAction request with a boolean id.
// 3. Send the matching upstream response.
// 4. Assert the response is forwarded unchanged.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run preserves a boolean-id action response without augmentation.
// @evidence contracts/testing.md#independent-expectations JSON-RPC ids must be strings or numbers; authored bytes establish pass-through equality.
// @evidence contracts/testing.md#distinguishing-cases A boolean id with an available plugin action is covered; other invalid shapes are separate.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxySkipsCodeActionWithNonIDShape in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxySkipsCodeActionWithNonIDShape(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    actions: []driver.LSPCodeAction{{Title: "should-not-appear"}},
  })

  request := []byte(`{"jsonrpc":"2.0","id":true,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("upstream did not see request:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":true,"result":[]}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("response was augmented despite invalid id shape:\n%s", got)
  }
}
