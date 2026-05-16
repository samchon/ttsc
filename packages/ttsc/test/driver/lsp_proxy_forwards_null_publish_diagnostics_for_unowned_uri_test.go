package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsNullPublishDiagnosticsForUnownedURI pins the
// `null` diagnostics shape through the merge short-circuit. Some LSP
// servers publish `"diagnostics":null` instead of `[]`; the proxy must
// not silently rewrite that to `[]` when the source has no contribution
// for the URI. With the merge bypassed, the wire shape stays exactly as
// upstream sent it.
//
// 1. Configure a source that contributes only for /a.ts.
// 2. Send upstream publishDiagnostics for /b.ts with diagnostics:null.
// 3. Assert the editor receives the original bytes.
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
}
