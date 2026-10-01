package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsUnaugmentedCodeActionResponse covers the negative branch
// where no codeAction request was remembered: a codeAction notification (no id)
// is never recorded, so an upstream response for an unknown id must be
// forwarded byte-identically. The proxy runs with the default null source; the
// "source contributes nothing" branch for a remembered id is covered by
// TestLSPProxyForwardsUnaugmentedResponseWhenSourceIsSilent.
//
// 1. Use the default null PluginSource (zero contributions).
// 2. Send a notification-shaped codeAction (no id) and assert it reaches
//    upstream byte-equal.
// 3. Send an upstream response with id=99 (not remembered).
// 4. Assert the editor sees the response bytes unchanged.
func TestLSPProxyForwardsUnaugmentedCodeActionResponse(t *testing.T) {
  h := newProxyHarness(t, nil)

  notification := []byte(`{"jsonrpc":"2.0","method":"textDocument/codeAction","params":{}}`)
  h.sendEditor(notification)
  if got := h.recvUpstream(); !bytes.Equal(got, notification) {
    t.Fatalf("notification mismatch:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":99,"result":[{"title":"tsgo"}]}`)
  h.sendUpstream(response)
  if got := h.recvEditor(); !bytes.Equal(got, response) {
    t.Fatalf("editor response mismatch:\n%s", got)
  }
}
