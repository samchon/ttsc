package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsPendingOnNormalizedCancelIDReverseDirection pins
// the inverse of the float→int normalization case. A regression that
// re-introduced asymmetric formatting in only one of the two
// `idKeyFromRaw` call sites (e.g. rememberCodeActionRequest using a
// stale local helper while forgetCancelledRequest used the shared one)
// would still pass the float→int test; this case catches the int→float
// half by remembering the request as `1.0` and cancelling with `1`.
//
// 1. Configure a source that would normally augment the response.
// 2. Send codeAction request id=1.0 and drain it upstream.
// 3. Send $/cancelRequest id=1.
// 4. Send the matching upstream response id=1.0.
// 5. Assert the editor receives the response unmodified.
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
