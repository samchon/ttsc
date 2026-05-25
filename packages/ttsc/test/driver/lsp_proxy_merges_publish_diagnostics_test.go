package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyMergesPublishDiagnostics verifies ttscserver's core diagnostics
// promise.
//
// plugin diagnostics ride alongside tsgo's typecheck findings in the
// same publishDiagnostics notification. Editors render them together
// without knowing two pipelines produced them.
//
// 1. Configure a PluginSource that contributes one diagnostic for /a.ts.
// 2. Send upstream publishDiagnostics for /a.ts with one upstream entry.
// 3. Assert upstream diagnostics are forwarded first.
// 4. Assert the async plugin publish contains both entries.
func TestLSPProxyMergesPublishDiagnostics(t *testing.T) {
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      "file:///a.ts": {{
        Range:    driver.LSPRange{Start: driver.LSPPosition{Line: 4, Character: 2}, End: driver.LSPPosition{Line: 4, Character: 6}},
        Severity: driver.LSPDiagnosticSeverityWarning,
        Source:   "ttsc/lint",
        Message:  "trailing spaces",
      }},
    },
  }
  h := newProxyHarness(t, source)

  upstream := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","diagnostics":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"severity":1,"message":"tsgo"}]}}`)
  h.sendUpstream(upstream)
  if got := h.recvEditor(); !bytes.Equal(got, upstream) {
    t.Fatalf("upstream diagnostics were not forwarded first:\ngot:  %s\nwant: %s", got, upstream)
  }
  body := h.recvEditor()

  if !strings.Contains(string(body), `"trailing spaces"`) {
    t.Fatalf("merged frame missing plugin diagnostic:\n%s", body)
  }
  if !strings.Contains(string(body), `"message":"tsgo"`) {
    t.Fatalf("merged frame dropped upstream diagnostic:\n%s", body)
  }
  var decoded struct {
    Params struct {
      Diagnostics []json.RawMessage `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("merged body not valid JSON: %v\n%s", err, body)
  }
  if got := len(decoded.Params.Diagnostics); got != 2 {
    t.Fatalf("expected 2 diagnostics, got %d in %s", got, body)
  }
}
