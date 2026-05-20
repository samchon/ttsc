package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRejectsBadCancelAndCodeActionPayloads verifies malformed payload
// branches forward unchanged.
//
// Cancellation and code-action augmentation both parse optional JSON payloads.
// Invalid shapes must not corrupt the proxy state or produce synthetic errors;
// the editor and upstream server should still see the original frames.
//
// 1. Forward cancel notifications with malformed and unsupported ids.
// 2. Remember a codeAction request.
// 3. Forward an upstream codeAction result whose JSON cannot be merged.
func TestLSPProxyRejectsBadCancelAndCodeActionPayloads(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    actions: []driver.LSPCodeAction{{Title: "local action"}},
  })

  badCancel := []byte(`{"jsonrpc":"2.0","method":"$/cancelRequest","params":"bad"}`)
  h.sendEditor(badCancel)
  if got := h.recvUpstream(); !bytes.Equal(got, badCancel) {
    t.Fatalf("bad cancel mismatch:\n%s", got)
  }

  emptyKeyCancel := []byte(`{"jsonrpc":"2.0","method":"$/cancelRequest","params":{"id":true}}`)
  h.sendEditor(emptyKeyCancel)
  if got := h.recvUpstream(); !bytes.Equal(got, emptyKeyCancel) {
    t.Fatalf("empty-key cancel mismatch:\n%s", got)
  }

  request := []byte(`{"jsonrpc":"2.0","id":41,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("codeAction request mismatch:\n%s", got)
  }

  invalidResult := []byte(`{"jsonrpc":"2.0","id":41,"result":[}`)
  h.sendUpstream(invalidResult)
  if got := h.recvEditor(); !bytes.Equal(got, invalidResult) {
    t.Fatalf("invalid result was rewritten:\n%s", got)
  }
}
