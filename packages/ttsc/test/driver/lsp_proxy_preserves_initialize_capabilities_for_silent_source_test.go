package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyPreservesInitializeCapabilitiesForSilentSource verifies a source
// with no LSP contributions does not mutate upstream capability metadata.
//
// In particular, a `codeActionProvider` option object without plugin
// `codeActionKinds` must not gain `codeActionKinds: []`, because clients can
// interpret an empty kind list as a narrowed provider contract.
//
// 1. Initialize through a NullPluginSource proxy.
// 2. Return an upstream codeActionProvider option object.
// 3. Assert the response body is forwarded byte-for-byte.
func TestLSPProxyPreservesInitializeCapabilitiesForSilentSource(t *testing.T) {
  h := newProxyHarness(t, nil)
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()

  upstream := []byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":{"resolveProvider":true}}}}`)
  h.sendUpstream(upstream)
  if got := h.recvEditor(); !bytes.Equal(got, upstream) {
    t.Fatalf("initialize response was mutated:\ngot:  %s\nwant: %s", got, upstream)
  }
}
