package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsMalformedUpstreamFrame Verifies Proxy.Run forwards non-JSON upstream bytes unchanged.
// The upstream-to-editor pump preserves frames whose envelope fails to decode.
// Actual editor parsing or user-facing diagnostics are not exercised here.
//
// The authored upstream blob supplies independent expected bytes.
//
// 1. Send a non-JSON body from upstream.
// 2. Assert the editor receives the same bytes.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards non-JSON upstream bytes unchanged.
// @evidence contracts/testing.md#independent-expectations The authored upstream blob supplies independent expected bytes.
// @evidence contracts/testing.md#distinguishing-cases Malformed upstream envelope contrasts with the separate editor-direction case.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyForwardsMalformedUpstreamFrame in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyForwardsMalformedUpstreamFrame(t *testing.T) {
  h := newProxyHarness(t, nil)
  payload := []byte("upstream blob")

  h.sendUpstream(payload)
  got := h.recvEditor()

  if !bytes.Equal(got, payload) {
    t.Fatalf("editor forward mismatch:\ngot:  %s\nwant: %s", got, payload)
  }
}
