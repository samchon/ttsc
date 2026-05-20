package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsPendingOnNormalizedCancelID pins the shared id
// normalizer between rememberCodeActionRequest and
// forgetCancelledRequest. A cancel arriving with id `1.0` must drop
// the pending entry stored under id `1` (and vice versa) — otherwise
// peers that disagree on numeric encoding leak pending entries across
// every cancelled codeAction request.
//
//  1. Configure a source whose CodeActions would augment the response.
//  2. Send codeAction request id=1 and drain it upstream.
//  3. Send $/cancelRequest id=1.0.
//  4. Send the matching upstream response id=1.
//  5. Assert the editor receives the response unmodified — the cancel
//     must have cleared the pending entry despite the different shape.
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
