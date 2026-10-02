package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyForwardsNullInitializeResult Verifies that a null initialize result forwards unchanged without a nil-map panic.
//
// Initialize is remembered before its matching null response arrives.
//
// 1. Forward an initialize request.
// 2. Return `result: null` from upstream.
// 3. Assert the editor receives the same frame.
//
// @evidence contracts/testing.md#behavioral-verification A null initialize result forwards unchanged without a nil-map panic.
// @evidence contracts/testing.md#independent-expectations JSON null is valid JSON but not an augmentable capabilities object.
// @evidence contracts/testing.md#distinguishing-cases Initialize is remembered before its matching null response arrives.
// @evidence contracts/testing.md#execution-ownership The command-advertising stub and synthetic response drive the Go pipe proxy. Go discovers TestLSPProxyForwardsNullInitializeResult under ./test/driver.
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
