package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsUnaugmentedResponseWhenSourceIsSilent covers
// appendCodeActions's empty-actions short-circuit. When the codeAction
// response matches a remembered request but the plugin source has
// nothing to contribute, the proxy must forward the upstream response
// byte-for-byte instead of marshaling a no-op envelope.
//
// 1. Use a source that contributes no code actions.
// 2. Send a codeAction request and drain it upstream.
// 3. Reply from upstream with one action.
// 4. Assert the editor receives the original bytes.
func TestLSPProxyForwardsUnaugmentedResponseWhenSourceIsSilent(t *testing.T) {
  h := newProxyHarness(t, &stubSource{})

  request := []byte(`{"jsonrpc":"2.0","id":21,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///x.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("upstream did not see request:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":21,"result":[{"title":"only-tsgo"}]}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("response was augmented unnecessarily:\n%s", got)
  }
}
