package driver_test

import (
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForcesLocalSymbolsOverUpstreamCapability Verifies
// ForceLocalSymbolProvider makes the proxy answer documentSymbol from the local
// recording SymbolProvider even when the authored upstream response advertises
// the capability. Graph extraction itself is not run here.
//
// The raw-LSP graph consumer that motivated the provider wants graph-derived
// declarations, not tsgo's language-service answer. The force flag overrides the
// default forward-when-advertised gate so that consumer still gets the graph
// outline.
//
//  1. Complete an initialize handshake whose upstream result advertises
//     documentSymbolProvider: true, with ForceLocalSymbolProvider set.
//  2. Send textDocument/documentSymbol from the editor.
//  3. Assert the local provider answered and no request reaches upstream within 150ms.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns alpha and calls the forced local provider once.
// @evidence contracts/testing.md#independent-expectations ForceLocalSymbolProvider overrides an upstream capability; the recording stub owns alpha.
// @evidence contracts/testing.md#distinguishing-cases Upstream provider true with forced local mode is covered; no-forward observation lasts 150ms.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyForcesLocalSymbolsOverUpstreamCapability in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyForcesLocalSymbolsOverUpstreamCapability(t *testing.T) {
  provider := &recordingSymbolProvider{
    symbols: []driver.LSPDocumentSymbol{{Name: "alpha", Kind: driver.LSPSymbolKind(13)}},
  }
  h := newProxyHarnessWithOptions(t, nil, driver.ProxyOptions{
    SymbolProvider:           provider,
    ForceLocalSymbolProvider: true,
  })

  request := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`)
  h.sendEditor(request)
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"documentSymbolProvider":true}}}`))
  _ = h.recvEditor()

  documentSymbol := symbolRequestBody(t, 2, "textDocument/documentSymbol", map[string]any{
    "textDocument": map[string]any{"uri": "file:///workspace/main.ts"},
  })
  h.sendEditor(documentSymbol)

  var symbols []driver.LSPDocumentSymbol
  decodeResult(t, h.recvEditor(), &symbols)
  if !symbolTreeHasName(symbols, "alpha") {
    t.Fatalf("forced local provider result missing alpha: %+v", symbols)
  }
  // Observe the authored local-dispatch interval, not arbitrary later traffic.
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  if calls := provider.documentSymbolCallCount(); calls != 1 {
    t.Fatalf("local provider consulted %d time(s), want 1", calls)
  }
}
