package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsUnaugmentedCodeActionResponse covers two negative
// branches in one scenario: the source contributes no actions, and the
// codeAction request was a notification (no id), so the proxy never
// remembered it. Both paths must yield byte-identical forwarding so
// editors that special-case the wire shape stay correct.
//
// 1. Use NullPluginSource (zero contributions).
// 2. Send a notification-shaped codeAction (no id).
// 3. Forward it upstream.
// 4. Send an upstream response with id=99 (not remembered).
// 5. Assert the editor sees the original bytes for both.
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
