package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsEditorToUpstream verifies the default forwarding
// behavior for editor->server traffic: a request the proxy does not
// intercept must reach upstream byte-for-byte. Without this, ttsc would
// silently drop initialize/initialized handshakes.
//
// The same pump branch handles handler-untouched requests, notifications,
// and responses; exercising it with an initialize request covers the
// "fall through to upstream" path.
//
// 1. Send an initialize request from the editor side.
// 2. Read what arrived at upstream.
// 3. Assert byte equality.
func TestLSPProxyForwardsEditorToUpstream(t *testing.T) {
  h := newProxyHarness(t, nil)
  initialize := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`)

  h.sendEditor(initialize)
  got := h.recvUpstream()

  if !bytes.Equal(got, initialize) {
    t.Fatalf("upstream frame mismatch:\ngot:  %s\nwant: %s", got, initialize)
  }
}
