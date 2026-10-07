package driver_test

import (
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsDocumentSymbolWhenUpstreamAdvertises Verifies that an advertised documentSymbol request forwards unchanged and the local provider remains uncalled during the authored observation.
//
// Advertised ownership contrasts with fallback entries; local silence is observed for 150 milliseconds.
//
// 1. Complete an initialize handshake whose upstream result advertises documentSymbolProvider: true.
// 2. Send textDocument/documentSymbol from the editor.
// 3. Assert the request reaches upstream verbatim and the local provider remains uncalled through the 150ms observation.
//
// @evidence contracts/testing.md#behavioral-verification An advertised documentSymbol request forwards unchanged; the provider call count stays zero after the authored 150ms no-editor-frame interval, not an arbitrary later scheduling guarantee.
// @evidence contracts/testing.md#independent-expectations The initialize capability assigns upstream ownership; original request bytes and zero calls define expectations.
// @evidence contracts/testing.md#distinguishing-cases Advertised ownership contrasts with fallback entries; local silence is observed for 150 milliseconds.
// @evidence contracts/testing.md#execution-ownership A recording provider and synthetic frames exercise dispatch in the in-process Go proxy. Go discovers TestLSPProxyForwardsDocumentSymbolWhenUpstreamAdvertises under ./test/driver.
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
