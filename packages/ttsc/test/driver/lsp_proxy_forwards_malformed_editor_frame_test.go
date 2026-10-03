package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsMalformedEditorFrame Verifies the fail-safe path on
// the editor-to-upstream pump: a frame whose envelope is not valid JSON
// is still forwarded verbatim so the upstream tsgo server gets a chance
// to reply with its own well-formed error response.
//
// Dropping the frame silently would leave the editor hung waiting for a
// response, which is the worst outcome for a proxy.
//
// 1. Send a non-JSON body that still has a valid Content-Length header.
// 2. Assert the same bytes show up upstream.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards a framed non-JSON editor body unchanged.
// @evidence contracts/testing.md#independent-expectations The authored payload is the pass-through oracle so upstream owns parsing errors.
// @evidence contracts/testing.md#distinguishing-cases Malformed envelope with valid framing differs from transport truncation.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyForwardsMalformedEditorFrame in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyForwardsMalformedEditorFrame(t *testing.T) {
  h := newProxyHarness(t, nil)
  payload := []byte("not json but framed")

  h.sendEditor(payload)
  got := h.recvUpstream()

  if !bytes.Equal(got, payload) {
    t.Fatalf("upstream forward mismatch:\ngot:  %s\nwant: %s", got, payload)
  }
}
