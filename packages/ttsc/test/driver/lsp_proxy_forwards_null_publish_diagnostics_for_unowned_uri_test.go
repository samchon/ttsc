package driver_test

import (
  "bytes"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsNullPublishDiagnosticsForUnownedURI Verifies the
// `null` diagnostics shape for a URI the plugin source does not own. Some LSP
// servers publish `"diagnostics":null` instead of `[]`; the editor must keep
// seeing that wire shape, and the proxy must not follow it with a merged
// frame that carries `[]`. (The upstream frame itself is forwarded verbatim
// before any asynchronous merge, so the trailing no-frame check is what
// detects a spurious rewritten publication.)
//
// The source owns a.ts while the authored b.ts body must retain null.
//
// 1. Configure a source that contributes only for /a.ts.
// 2. Send upstream publishDiagnostics for /b.ts with diagnostics:null.
// 3. Assert the editor receives the original bytes.
// 4. Assert no further editor frame arrives within a short window.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run preserves unowned diagnostics:null with no extra frame during 150ms.
// @evidence contracts/testing.md#independent-expectations The source owns a.ts while the authored b.ts body must retain null.
// @evidence contracts/testing.md#distinguishing-cases Owned and unowned URI differ; the no-extra-frame observation is bounded.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyForwardsNullPublishDiagnosticsForUnownedURI in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyForwardsNullPublishDiagnosticsForUnownedURI(t *testing.T) {
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      "file:///a.ts": {{Message: "only-for-a"}},
    },
  }
  h := newProxyHarness(t, source)

  upstream := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///b.ts","diagnostics":null}}`)
  h.sendUpstream(upstream)
  if got := h.recvEditor(); !bytes.Equal(got, upstream) {
    t.Fatalf("null diagnostics was rewritten:\ngot:  %s\nwant: %s", got, upstream)
  }
  h.expectNoEditorFrame(150 * time.Millisecond)
}
