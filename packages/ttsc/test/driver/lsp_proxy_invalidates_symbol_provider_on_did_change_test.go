package driver_test

import (
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyInvalidatesSymbolProviderOnDidChange Verifies the proxy calls
// SymbolProvider.Invalidate when it forwards textDocument/didChange. The
// recording provider observes the hook, not a refreshed compiler result.
//
// The graph provider caches its compiler load; without invalidation an editor
// session would freeze at the first outline. The proxy therefore calls
// Invalidate on every buffer-changing notification.
//
// 1. Wire a recording SymbolProvider.
// 2. Send textDocument/didChange from the editor.
// 3. Assert the provider was invalidated (and the notification still forwards).
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards didChange unchanged and records a positive SymbolProvider invalidation count.
// @evidence contracts/testing.md#independent-expectations An editor content change must invalidate the provider cache before later outline queries; the recording provider exposes that hook independently.
// @evidence contracts/testing.md#distinguishing-cases A single didChange owns the invalidation trigger; this body does not query a refreshed documentSymbol or references result.
// @evidence contracts/testing.md#execution-ownership Go test/driver uses a temporary URI and recording provider with the in-process pipe proxy, without a native compiler host.
func TestLSPProxyInvalidatesSymbolProviderOnDidChange(t *testing.T) {
  provider := &recordingSymbolProvider{}
  h := newProxyHarnessWithOptions(t, nil, driver.ProxyOptions{SymbolProvider: provider})

  uri := writeLSPDiskFile(t, "const a = 1;\n")
  didChange := []byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":%q,"version":2},"contentChanges":[{"text":"const a = 2;\n"}]}}`, uri))
  h.sendEditor(didChange)
  // didChange is forwarded to upstream; draining it confirms the proxy processed
  // the notification (invalidation runs synchronously before the forward).
  if got := h.recvUpstream(); string(got) != string(didChange) {
    t.Fatalf("didChange was not forwarded verbatim:\ngot:  %s\nwant: %s", got, didChange)
  }
  if got := provider.invalidationCount(); got == 0 {
    t.Fatal("didChange did not invalidate the SymbolProvider")
  }
}
