package driver_test

import (
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyInvalidatesSymbolProviderOnDidSave Verifies that didSave forwards unchanged and invalidates the recording SymbolProvider.
//
// Invalidation presence is asserted, not an exact count or rebuilt graph content.
//
// 1. Wire a recording SymbolProvider.
// 2. Send textDocument/didSave from the editor.
// 3. Assert the provider was invalidated (and the notification still forwards).
//
// @evidence contracts/testing.md#behavioral-verification didSave forwards unchanged and invalidates the recording SymbolProvider.
// @evidence contracts/testing.md#independent-expectations A saved edit requires subsequent graph queries to discard their prior snapshot.
// @evidence contracts/testing.md#distinguishing-cases Invalidation presence is asserted, not an exact count or rebuilt graph content.
// @evidence contracts/testing.md#execution-ownership The Go proxy calls a recording provider using a temporary source URI. Go discovers TestLSPProxyInvalidatesSymbolProviderOnDidSave under ./test/driver.
func TestLSPProxyInvalidatesSymbolProviderOnDidSave(t *testing.T) {
  provider := &recordingSymbolProvider{}
  h := newProxyHarnessWithOptions(t, nil, driver.ProxyOptions{SymbolProvider: provider})

  uri := writeLSPDiskFile(t, "const a = 1;\n")
  didSave := []byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":%q,"version":2}}}`, uri))
  h.sendEditor(didSave)
  // didSave is forwarded to upstream; draining it confirms the proxy processed
  // the notification (invalidation runs synchronously before the forward).
  if got := h.recvUpstream(); string(got) != string(didSave) {
    t.Fatalf("didSave was not forwarded verbatim:\ngot:  %s\nwant: %s", got, didSave)
  }
  if got := provider.invalidationCount(); got == 0 {
    t.Fatal("didSave did not invalidate the SymbolProvider")
  }
}
