package driver_test

import (
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsDocumentSymbolWhenUpstreamAdvertises verifies the proxy
// forwards textDocument/documentSymbol to upstream tsgo when tsgo advertised the
// capability, instead of hijacking it with the local graph SymbolProvider.
//
// tsgo implements documentSymbol with its compiler-exact language service. When
// its initialize result advertises documentSymbolProvider and the local provider
// is not forced, the proxy must leave the request to tsgo so the editor gets the
// precise answer rather than the coarse graph outline (#620).
//
//  1. Complete an initialize handshake whose upstream result advertises
//     documentSymbolProvider: true.
//  2. Send textDocument/documentSymbol from the editor.
//  3. Assert the request reaches upstream verbatim and the local provider is
//     never consulted.
func TestLSPProxyForwardsDocumentSymbolWhenUpstreamAdvertises(t *testing.T) {
  provider := &recordingSymbolProvider{}
  h := newProxyHarnessWithOptions(t, nil, driver.ProxyOptions{SymbolProvider: provider})

  request := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`)
  h.sendEditor(request)
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"documentSymbolProvider":true}}}`))
  // Draining the initialize response synchronizes on the proxy recording the
  // upstream capability before the documentSymbol request is sent.
  _ = h.recvEditor()

  documentSymbol := symbolRequestBody(t, 2, "textDocument/documentSymbol", map[string]any{
    "textDocument": map[string]any{"uri": "file:///workspace/main.ts"},
  })
  h.sendEditor(documentSymbol)
  if got := h.recvUpstream(); string(got) != string(documentSymbol) {
    t.Fatalf("documentSymbol was not forwarded verbatim:\ngot:  %s\nwant: %s", got, documentSymbol)
  }
  // The proxy answered nothing locally, so no editor frame is produced here.
  h.expectNoEditorFrame(150 * time.Millisecond)
  if calls := provider.documentSymbolCallCount(); calls != 0 {
    t.Fatalf("local provider was consulted %d time(s); tsgo should own documentSymbol", calls)
  }
}
