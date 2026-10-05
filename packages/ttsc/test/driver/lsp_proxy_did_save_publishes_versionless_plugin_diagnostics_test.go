package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidSavePublishesVersionlessPluginDiagnostics Verifies document
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
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run publishes saved without inheriting cached upstream version 7.
// @evidence contracts/testing.md#independent-expectations LSP didSave has an unversioned identifier; the stub only accepts versionless queries.
// @evidence contracts/testing.md#distinguishing-cases Versioned upstream cache contrasts with later versionless save.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyDidSavePublishesVersionlessPluginDiagnostics in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
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

  upstream := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","version":7,"diagnostics":[]}}`)
  h.sendUpstream(upstream)
  if got := h.recvEditor(); string(got) != string(upstream) {
    t.Fatalf("versioned upstream publication was not forwarded unchanged:\n%s", got)
  }
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
  var publication struct {
    Method string                     `json:"method"`
    Params map[string]json.RawMessage `json:"params"`
  }
  if err := json.Unmarshal(body, &publication); err != nil {
    t.Fatalf("publication member keys are not JSON: %v", err)
  }
  if _, exists := publication.Params["version"]; exists || publication.Method != "textDocument/publishDiagnostics" {
    t.Fatalf("versionless save must omit the publication version member: %s", body)
  }
}
