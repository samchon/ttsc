package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsEditorToUpstream Verifies the default forwarding
// behavior for editor->server traffic: a request the proxy does not
// intercept must reach upstream byte-for-byte. Without this, ttsc would
// silently drop initialize/initialized handshakes.
//
// Only one message kind is exercised here: a handler-untouched request
// (initialize) falling through to upstream. Notifications and responses on the
// same pump are covered by other tests, not this one.
//
// 1. Send an initialize request from the editor side.
// 2. Read what arrived at upstream.
// 3. Assert byte equality.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards an unintercepted initialize body unchanged.
// @evidence contracts/testing.md#independent-expectations The authored request bytes ground equality independently of dispatch.
// @evidence contracts/testing.md#distinguishing-cases One request is covered; notification and response forwarding have separate cases.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyForwardsEditorToUpstream in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyForwardsEditorToUpstream(t *testing.T) {
  h := newProxyHarness(t, nil)
  initialize := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`)

  h.sendEditor(initialize)
  got := h.recvUpstream()

  if !bytes.Equal(got, initialize) {
    t.Fatalf("upstream frame mismatch:\ngot:  %s\nwant: %s", got, initialize)
  }
}
