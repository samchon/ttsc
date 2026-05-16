package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsUpstreamToEditor pins the mirror of the editor-to-
// upstream forwarding case: a server->editor frame the proxy does not
// rewrite must round-trip unchanged. Every LSP response/notification
// flows through this branch unless it triggers the merge intercepts.
//
// 1. Send a response from upstream.
// 2. Read what arrived at the editor side.
// 3. Assert byte equality.
func TestLSPProxyForwardsUpstreamToEditor(t *testing.T) {
  h := newProxyHarness(t, nil)
  response := []byte(`{"jsonrpc":"2.0","id":7,"result":{"capabilities":{"hoverProvider":true}}}`)

  h.sendUpstream(response)
  got := h.recvEditor()

  if !bytes.Equal(got, response) {
    t.Fatalf("editor frame mismatch:\ngot:  %s\nwant: %s", got, response)
  }
}
