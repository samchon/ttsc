package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsPendingOnCancelRequest Verifies the `$/cancelRequest`
// handling that prevents pendingActions from leaking entries across a
// long editor session. After the cancel notification, an upstream
// response for the same id must be forwarded verbatim. The proxy can
// no longer correlate it to a remembered codeAction request because
// the editor has moved on.
//
// 1. Configure a plugin action and forward codeAction request id 51.
// 2. Forward cancellation id 51 and then return its upstream response.
// 3. Require the response bytes unchanged after cancellation.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards request and cancellation bytes unchanged, then forwards the matching upstream response without adding the configured plugin action.
// @evidence contracts/testing.md#independent-expectations Once id 51 is canceled, the remembered code-action contribution must not alter its later response; literal response bytes are the oracle.
// @evidence contracts/testing.md#distinguishing-cases Cancellation before the upstream response owns pending-request removal; cancellation during blocked augmentation has a separate case.
// @evidence contracts/testing.md#execution-ownership Go test/driver drives the actual proxy through its pipe harness and a stub source without native processes.
func TestLSPProxyClearsPendingOnCancelRequest(t *testing.T) {
  source := &stubSource{
    actions: []driver.LSPCodeAction{{Title: "should-not-appear"}},
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":51,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("request not forwarded:\n%s", got)
  }

  cancel := []byte(`{"jsonrpc":"2.0","method":"$/cancelRequest","params":{"id":51}}`)
  h.sendEditor(cancel)
  if got := h.recvUpstream(); !bytes.Equal(got, cancel) {
    t.Fatalf("cancel notification not forwarded:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":51,"result":[{"title":"upstream-action"}]}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("response was augmented after cancel:\n%s", got)
  }
}
