package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsPublishDiagnosticsForUnownedURI pins the
// short-circuit in mergePublishDiagnostics: when the source has no
// opinion on the URI, the merge returns `(_, false)` and the original
// upstream bytes flow through unchanged. Re-encoding through the merge
// path would perturb whitespace and key order — both invisible to
// strict-parsing editors but noisy in tests that diff wire traffic.
//
// 1. Configure a source that contributes only for /a.ts.
// 2. Send upstream publishDiagnostics for /b.ts.
// 3. Assert the editor receives the original bytes.
func TestLSPProxyForwardsPublishDiagnosticsForUnownedURI(t *testing.T) {
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      "file:///a.ts": {{Message: "only-for-a"}},
    },
  }
  h := newProxyHarness(t, source)

  upstream := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///b.ts","diagnostics":[{"range":{"start":{"line":1,"character":1},"end":{"line":1,"character":2}},"severity":2,"message":"only-tsgo"}]}}`)
  h.sendUpstream(upstream)
  if got := h.recvEditor(); !bytes.Equal(got, upstream) {
    t.Fatalf("non-targeted URI was rewritten:\ngot:  %s\nwant: %s", got, upstream)
  }
}
