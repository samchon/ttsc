package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidSavePublishesVersionlessPluginDiagnostics verifies document
// notifications do not reuse a cached upstream version.
//
// Real LSP didSave notifications carry a TextDocumentIdentifier, not a
// VersionedTextDocumentIdentifier. If the proxy stamps disk-backed plugin
// diagnostics with an older upstream version, VS Code can discard the publish
// and keep stale squiggles visible.
//
// 1. Cache an upstream publishDiagnostics notification with version 7.
// 2. Send a versionless didSave notification.
// 3. Assert the plugin publish has no version field.
func TestLSPProxyDidSavePublishesVersionlessPluginDiagnostics(t *testing.T) {
  source := &stubSource{
    diagnosticsFor: func(doc driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      if doc.Version != nil {
        return nil
      }
      return []driver.LSPDiagnostic{{Source: "ttsc/lint", Message: "saved"}}
    },
  }
  h := newProxyHarness(t, source)

  h.sendUpstream([]byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","version":7,"diagnostics":[]}}`))
  _ = h.recvEditor()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()

  body := h.recvEditor()
  var decoded struct {
    Params struct {
      Version     *int `json:"version,omitempty"`
      Diagnostics []struct {
        Message string `json:"message"`
      } `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("publish notification was not JSON: %v\n%s", err, body)
  }
  if decoded.Params.Version != nil {
    t.Fatalf("versionless didSave publish reused cached version: %s", body)
  }
  if len(decoded.Params.Diagnostics) != 1 || decoded.Params.Diagnostics[0].Message != "saved" {
    t.Fatalf("unexpected diagnostics publish: %s", body)
  }
}
