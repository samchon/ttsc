package driver_test

import (
  "strings"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsOlderVersionlessPluginDiagnosticsGeneration verifies the
// newest same-URI plugin diagnostic run wins.
//
// Versionless document notifications can race because the sidecar work runs
// asynchronously. Without a per-URI generation, an older slow save can publish
// after a newer save and restore stale plugin diagnostics.
//
// 1. Block the first versionless didSave plugin diagnostic run.
// 2. Send a second didSave for the same URI and let it publish.
// 3. Release the first run.
// 4. Assert the older result is dropped.
func TestLSPProxyDropsOlderVersionlessPluginDiagnosticsGeneration(t *testing.T) {
  firstStarted := make(chan struct{})
  releaseFirst := make(chan struct{})
  var calls atomic.Int32
  source := &stubSource{
    diagnosticsFor: func(doc driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      if doc.URI != "file:///a.ts" || doc.Version != nil {
        return nil
      }
      switch calls.Add(1) {
      case 1:
        close(firstStarted)
        <-releaseFirst
        return []driver.LSPDiagnostic{{Source: "ttsc/lint", Message: "old"}}
      default:
        return []driver.LSPDiagnostic{{Source: "ttsc/lint", Message: "new"}}
      }
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()
  select {
  case <-firstStarted:
  case <-time.After(2 * time.Second):
    t.Fatal("first plugin diagnostic run did not start")
  }
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()
  if body := h.recvEditor(); !strings.Contains(string(body), "new") || strings.Contains(string(body), "old") {
    t.Fatalf("expected only newest diagnostics, got:\n%s", body)
  }
  close(releaseFirst)
  h.expectNoEditorFrame(150 * time.Millisecond)
}
