package driver_test

import (
  "strings"
  "testing"
)

// TestLSPProxyForwardsUnownedSourceFormatCodeAction Verifies generic source
// format requests are not reserved when no plugin owns formatting.
//
// The proxy may answer source-only requests locally only when the active plugin
// source advertised or owns the relevant ttsc action. Treating `source.format`
// as always plugin-only suppresses upstream/source actions in projects without
// an LSP formatting plugin.
//
// 1. Initialize with upstream `codeActionProvider: true` and an empty source.
// 2. Request only `source.format`.
// 3. Assert the request is forwarded to upstream.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards source.format when its source owns no formatting.
// @evidence contracts/testing.md#independent-expectations Upstream supports actions and an unowned generic kind remains upstream work.
// @evidence contracts/testing.md#distinguishing-cases Empty source with upstream enabled is covered; fields identify forwarding without full byte equality.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyForwardsUnownedSourceFormatCodeAction in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyForwardsUnownedSourceFormatCodeAction(t *testing.T) {
  h := newProxyHarness(t, &stubSource{})
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":true}}}`))
  _ = h.recvEditor()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.format"]}}}`))
  body := h.recvUpstream()
  if !strings.Contains(string(body), `"method":"textDocument/codeAction"`) || !strings.Contains(string(body), `"source.format"`) {
    t.Fatalf("source.format request was not forwarded upstream:\n%s", body)
  }
}
