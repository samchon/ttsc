package driver_test

import (
  "bytes"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsPublishDiagnosticsForUnownedURI pins that an upstream
// publishDiagnostics for a URI the plugin source has no opinion on reaches the
// editor as the original upstream bytes, and that the proxy publishes no
// additional merged frame for it afterwards. (The proxy forwards the upstream
// frame verbatim before any asynchronous merge, so the byte comparison alone
// cannot detect a re-encoding merge; the trailing no-frame check is what
// detects a spurious second publication.)
//
// 1. Configure a source that contributes only for /a.ts.
// 2. Send upstream publishDiagnostics for /b.ts.
// 3. Assert the editor receives the original bytes.
// 4. Assert no further editor frame arrives within a short window.
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
  h.expectNoEditorFrame(150 * time.Millisecond)
}
