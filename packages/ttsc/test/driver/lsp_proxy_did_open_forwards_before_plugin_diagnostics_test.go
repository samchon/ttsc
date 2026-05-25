package driver_test

import (
  "fmt"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidOpenForwardsBeforePluginDiagnostics verifies document-open
// notifications are not blocked by slow plugin diagnostics.
//
// Sidecar-backed diagnostics can take seconds on a cold cache. The proxy must
// forward `didOpen` to tsgo immediately so hover/completion and TypeScript
// diagnostics are not delayed by the plugin pipeline.
//
// 1. Configure a source whose Diagnostics blocks.
// 2. Send `textDocument/didOpen` from the editor.
// 3. Assert upstream receives the notification within a short window.
func TestLSPProxyDidOpenForwardsBeforePluginDiagnostics(t *testing.T) {
  release := make(chan struct{})
  source := &stubSource{
    diagnosticsFor: func(driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      <-release
      return []driver.LSPDiagnostic{{Message: "plugin"}}
    },
  }
  h := newProxyHarness(t, source)
  defer close(release)

  uri := writeLSPDiskFile(t, "export {};")
  didOpen := []byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"export {};"}}}`, uri))
  h.sendEditor(didOpen)

  type result struct {
    body []byte
    err  error
  }
  ch := make(chan result, 1)
  go func() {
    _, body, err := h.upstreamInFR.Read()
    ch <- result{body: body, err: err}
  }()
  select {
  case got := <-ch:
    if got.err != nil {
      t.Fatalf("upstream read failed: %v", got.err)
    }
    if string(got.body) != string(didOpen) {
      t.Fatalf("upstream didOpen mismatch:\n%s", got.body)
    }
  case <-time.After(200 * time.Millisecond):
    t.Fatal("didOpen was blocked by plugin diagnostics")
  }
}
