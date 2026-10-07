package driver_test

import (
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsReferencesWhenUpstreamAdvertises Verifies that advertised references forward unchanged without consulting the local provider.
//
// The advertised route complements graph fallback coverage and observes bounded local silence.
//
// 1. Complete an initialize handshake whose upstream result advertises referencesProvider: true.
// 2. Send textDocument/references from the editor.
// 3. Assert the request reaches upstream verbatim and the local provider stays uncalled through the 150ms observation.
//
// @evidence contracts/testing.md#behavioral-verification Advertised references forward unchanged without consulting the local provider.
// @evidence contracts/testing.md#independent-expectations The capability assigns upstream ownership; authored request bytes and zero calls define expectations.
// @evidence contracts/testing.md#distinguishing-cases The advertised route complements graph fallback coverage and observes bounded local silence.
// @evidence contracts/testing.md#execution-ownership A recording SymbolProvider and private Go proxy session inspect dispatch without a server process. Go discovers TestLSPProxyForwardsReferencesWhenUpstreamAdvertises under ./test/driver.
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
