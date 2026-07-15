package driver_test

import (
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyInvalidatesSymbolProviderOnDidSave verifies the proxy discards the
// SymbolProvider's cached graph on textDocument/didSave, the notification whose
// on-disk write the graph provider rebuilds against, so the outline reflects the
// saved edit rather than the first-request snapshot (#620).
//
// 1. Wire a recording SymbolProvider.
// 2. Send textDocument/didSave from the editor.
// 3. Assert the provider was invalidated (and the notification still forwards).
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
