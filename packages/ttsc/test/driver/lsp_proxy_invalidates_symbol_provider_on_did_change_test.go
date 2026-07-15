package driver_test

import (
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyInvalidatesSymbolProviderOnDidChange verifies the proxy discards
// the SymbolProvider's cached graph on textDocument/didChange so a later
// documentSymbol/references request reflects the edit instead of the stale
// first-request snapshot (#620).
//
// The graph provider caches its compiler load; nothing invalidated it, so an
// editor session froze at the first outline. The proxy now calls Invalidate on
// every buffer-changing notification.
//
// 1. Wire a recording SymbolProvider.
// 2. Send textDocument/didChange from the editor.
// 3. Assert the provider was invalidated (and the notification still forwards).
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
