package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsUpstreamToEditor Verifies ordinary server-to-editor
// forwarding: a server-to-editor frame the proxy does not
// rewrite must round-trip unchanged. Every LSP response/notification
// flows through this branch unless it triggers the merge intercepts.
//
// 1. Send a response from upstream.
// 2. Read what arrived at the editor side.
// 3. Assert byte equality.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards the literal upstream capabilities response byte-for-byte to the editor pipe.
// @evidence contracts/testing.md#independent-expectations A response without a matching intercept must retain the original envelope bytes.
// @evidence contracts/testing.md#distinguishing-cases This owns ordinary upstream-to-editor forwarding; initialize augmentation and codeAction merging have separate fixtures.
// @evidence contracts/testing.md#execution-ownership Go test/driver runs the real byte proxy using the pipe harness with nil source, without a TypeScript-Go server.
func TestLSPProxyForwardsUpstreamToEditor(t *testing.T) {
  h := newProxyHarness(t, nil)
  response := []byte(`{"jsonrpc":"2.0","id":7,"result":{"capabilities":{"hoverProvider":true}}}`)

  h.sendUpstream(response)
  got := h.recvEditor()

  if !bytes.Equal(got, response) {
    t.Fatalf("editor frame mismatch:\ngot:  %s\nwant: %s", got, response)
  }
}
