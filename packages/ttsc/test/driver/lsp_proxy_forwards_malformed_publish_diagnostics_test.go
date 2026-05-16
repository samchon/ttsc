package driver_test

import (
  "bytes"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsMalformedPublishDiagnostics verifies the merge
// path's safety net: a publishDiagnostics notification whose params
// cannot be decoded must still reach the editor verbatim. Without this
// guard, a tsgo schema change would silently swallow upstream diagnostics.
//
// 1. Configure a source that would contribute a diagnostic.
// 2. Send upstream a publishDiagnostics with non-object params.
// 3. Assert the editor sees the same bytes.
func TestLSPProxyForwardsMalformedPublishDiagnostics(t *testing.T) {
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      "file:///a.ts": {{Message: "x"}},
    },
  }
  h := newProxyHarness(t, source)

  payload := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":"oops"}`)
  h.sendUpstream(payload)
  body := h.recvEditor()
  if !bytes.Equal(body, payload) {
    t.Fatalf("malformed publishDiagnostics was rewritten:\n%s", body)
  }
}
