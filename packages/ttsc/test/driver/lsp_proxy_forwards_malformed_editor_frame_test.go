package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsMalformedEditorFrame locks the fail-safe path on
// the editor-to-upstream pump: a frame whose envelope is not valid JSON
// is still forwarded verbatim so the upstream tsgo server gets a chance
// to reply with its own well-formed error response.
//
// Dropping the frame silently would leave the editor hung waiting for a
// response, which is the worst outcome for a proxy.
//
// 1. Send a non-JSON body that still has a valid Content-Length header.
// 2. Assert the same bytes show up upstream.
func TestLSPProxyForwardsMalformedEditorFrame(t *testing.T) {
  h := newProxyHarness(t, nil)
  payload := []byte("not json but framed")

  h.sendEditor(payload)
  got := h.recvUpstream()

  if !bytes.Equal(got, payload) {
    t.Fatalf("upstream forward mismatch:\ngot:  %s\nwant: %s", got, payload)
  }
}
