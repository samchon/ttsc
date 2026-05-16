package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsMalformedUpstreamFrame mirrors the editor-side
// fail-safe on the upstream-to-editor pump. The proxy must not eat
// frames whose envelope fails to decode — the editor's parser will tell
// the user, which is more useful than silent dropping.
//
// 1. Send a non-JSON body from upstream.
// 2. Assert the editor receives the same bytes.
func TestLSPProxyForwardsMalformedUpstreamFrame(t *testing.T) {
  h := newProxyHarness(t, nil)
  payload := []byte("upstream blob")

  h.sendUpstream(payload)
  got := h.recvEditor()

  if !bytes.Equal(got, payload) {
    t.Fatalf("editor forward mismatch:\ngot:  %s\nwant: %s", got, payload)
  }
}
