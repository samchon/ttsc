package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsPendingOnCancelRequest pins the `$/cancelRequest`
// handling that prevents pendingActions from leaking entries across a
// long editor session. After the cancel notification, an upstream
// response for the same id must be forwarded verbatim — the proxy can
// no longer correlate it to a remembered codeAction request because
// the editor has moved on.
//
// 1. Configure a source that would normally augment the response.
// 2. Send codeAction request id=51 and drain it upstream.
// 3. Send $/cancelRequest id=51.
// 4. Send the matching upstream response with the same id.
// 5. Assert the editor sees the response unmodified.
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
