package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyMergesPublishDiagnosticsIntoEmptyUpstream verifies plugin
// diagnostics still surface when tsgo found nothing. That is the most
// editor-realistic shape for lint-only feedback on a type-clean file
// and the core product promise of ttscserver: lint findings reach the
// editor even when the type checker is silent.
//
// Locks the merge branch in lsp_proxy.go::mergePublishDiagnostics for
// the "upstream silent / plugin contributes" combination. A future
// short-circuit that returned early on `len(upstream)==0` would
// silently drop every plugin-only finding without this test turning
// red.
//
// 1. Configure a source that contributes one diagnostic for /a.ts.
// 2. Send upstream publishDiagnostics for /a.ts with diagnostics:[].
// 3. Assert the empty upstream publish is forwarded first.
// 4. Assert the async plugin publish contains a single plugin diagnostic.
func TestLSPProxyMergesPublishDiagnosticsIntoEmptyUpstream(t *testing.T) {
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      "file:///a.ts": {{
        Range:    driver.LSPRange{Start: driver.LSPPosition{Line: 0, Character: 0}, End: driver.LSPPosition{Line: 0, Character: 5}},
        Severity: driver.LSPDiagnosticSeverityWarning,
        Source:   "ttsc/lint",
        Message:  "lint-only",
      }},
    },
  }
  h := newProxyHarness(t, source)

  upstream := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","diagnostics":[]}}`)
  h.sendUpstream(upstream)
  if got := h.recvEditor(); !bytes.Equal(got, upstream) {
    t.Fatalf("empty upstream diagnostics were not forwarded first:\ngot:  %s\nwant: %s", got, upstream)
  }
  body := h.recvEditor()

  var decoded struct {
    Params struct {
      Diagnostics []json.RawMessage `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("merged body not JSON: %v\n%s", err, body)
  }
  if got := len(decoded.Params.Diagnostics); got != 1 {
    t.Fatalf("expected 1 diagnostic (plugin only), got %d in %s", got, body)
  }
  if !strings.Contains(string(body), `"lint-only"`) {
    t.Fatalf("plugin diagnostic missing:\n%s", body)
  }
}
