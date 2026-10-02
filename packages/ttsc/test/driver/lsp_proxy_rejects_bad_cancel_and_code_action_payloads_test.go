package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRejectsBadCancelAndCodeActionPayloads Verifies that malformed cancel params, unsupported cancel IDs, and invalid action-result JSON forward unchanged.
//
// A bad params string, boolean ID, and invalid result JSON exercise separate parse paths.
//
// 1. Forward cancel notifications with malformed and unsupported ids.
// 2. Remember a codeAction request.
// 3. Forward an upstream codeAction result whose JSON cannot be merged.
//
// @evidence contracts/testing.md#behavioral-verification Malformed cancel params, unsupported cancel IDs, and invalid action-result JSON forward unchanged.
// @evidence contracts/testing.md#independent-expectations Original authored frames define safe forwarding for uninterpretable payloads.
// @evidence contracts/testing.md#distinguishing-cases A bad params string, boolean ID, and invalid result JSON exercise separate parse paths.
// @evidence contracts/testing.md#execution-ownership Each explicit malformed frame enters the actual Go proxy's normal framing pumps. Go discovers TestLSPProxyRejectsBadCancelAndCodeActionPayloads under ./test/driver.
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
