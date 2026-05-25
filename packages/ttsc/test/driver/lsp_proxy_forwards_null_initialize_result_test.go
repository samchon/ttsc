package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsNullInitializeResult verifies malformed-but-valid
// initialize responses do not crash the proxy.
//
// JSON-RPC can carry `result: null`; it is not an augmentable LSP initialize
// result, but the proxy should still forward it unchanged instead of assigning
// into a nil decoded map.
//
// 1. Forward an initialize request.
// 2. Return `result: null` from upstream.
// 3. Assert the editor receives the same frame.
func TestLSPProxyForwardsNullInitializeResult(t *testing.T) {
  h := newProxyHarness(t, &stubSource{commands: []string{"ttsc.lint.fixAll"}})
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()

  upstream := []byte(`{"jsonrpc":"2.0","id":1,"result":null}`)
  h.sendUpstream(upstream)
  if got := h.recvEditor(); !bytes.Equal(got, upstream) {
    t.Fatalf("null initialize response was mutated:\ngot:  %s\nwant: %s", got, upstream)
  }
}
