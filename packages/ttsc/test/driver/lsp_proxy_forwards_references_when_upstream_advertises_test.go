package driver_test

import (
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsReferencesWhenUpstreamAdvertises verifies the proxy
// forwards textDocument/references to upstream tsgo when tsgo advertised the
// capability, instead of hijacking it with the local graph SymbolProvider.
//
// tsgo implements references with its compiler-exact language service. When its
// initialize result advertises referencesProvider and the local provider is not
// forced, the proxy must leave the request to tsgo so the editor gets every real
// usage rather than the graph's coarse edge set (#620).
//
//  1. Complete an initialize handshake whose upstream result advertises
//     referencesProvider: true.
//  2. Send textDocument/references from the editor.
//  3. Assert the request reaches upstream verbatim and the local provider is
//     never consulted.
func TestLSPProxyForwardsReferencesWhenUpstreamAdvertises(t *testing.T) {
  provider := &recordingSymbolProvider{}
  h := newProxyHarnessWithOptions(t, nil, driver.ProxyOptions{SymbolProvider: provider})

  request := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`)
  h.sendEditor(request)
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"referencesProvider":true}}}`))
  _ = h.recvEditor()

  references := symbolRequestBody(t, 2, "textDocument/references", map[string]any{
    "textDocument": map[string]any{"uri": "file:///workspace/main.ts"},
    "position":     map[string]any{"line": 0, "character": 0},
    "context":      map[string]any{"includeDeclaration": true},
  })
  h.sendEditor(references)
  if got := h.recvUpstream(); string(got) != string(references) {
    t.Fatalf("references was not forwarded verbatim:\ngot:  %s\nwant: %s", got, references)
  }
  h.expectNoEditorFrame(150 * time.Millisecond)
  if calls := provider.referenceCallCount(); calls != 0 {
    t.Fatalf("local provider was consulted %d time(s); tsgo should own references", calls)
  }
}
