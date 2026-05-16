package driver_test

import (
  "bytes"
  "testing"
)

// TestLSPProxyRoundTripsServerInitiatedApplyEdit pins the contract for
// upstream-initiated requests (tsgo issues workspace/applyEdit during
// refactor flows). The proxy must forward both the server→editor
// request and the editor→server response byte-for-byte; any future
// intercept that filters editor→server responses must not swallow the
// applyEdit reply tsgo is waiting on.
//
// 1. Send a workspace/applyEdit request from upstream.
// 2. Assert it arrives at the editor verbatim.
// 3. Send the editor's response.
// 4. Assert it arrives upstream verbatim.
func TestLSPProxyRoundTripsServerInitiatedApplyEdit(t *testing.T) {
  h := newProxyHarness(t, nil)

  request := []byte(`{"jsonrpc":"2.0","id":42,"method":"workspace/applyEdit","params":{"edit":{"changes":{}}}}`)
  h.sendUpstream(request)
  if got := h.recvEditor(); !bytes.Equal(got, request) {
    t.Fatalf("server-initiated request mismatch:\n%s", got)
  }

  response := []byte(`{"jsonrpc":"2.0","id":42,"result":{"applied":true}}`)
  h.sendEditor(response)
  if got := h.recvUpstream(); !bytes.Equal(got, response) {
    t.Fatalf("editor response mismatch:\n%s", got)
  }
}
