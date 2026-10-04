package driver_test

import (
  "encoding/json"
  "strings"
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsOlderVersionlessPluginDiagnosticsGeneration Verifies the
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
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run publishes only new from the second versionless save and suppresses the released first old result during the 150ms window.
// @evidence contracts/testing.md#independent-expectations Later same-URI generation wins independently of a version field; authored old/new messages identify which computation reached the editor.
// @evidence contracts/testing.md#distinguishing-cases A blocked first save and completed second save exercise out-of-order completion; absence of a later old frame is observed for a bounded interval.
// @evidence contracts/testing.md#execution-ownership The Go test/driver pipe harness and controlled diagnostic callback execute the real proxy in process without sidecars.
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
  var releaseOnce sync.Once
  releaseCallback := func() { releaseOnce.Do(func() { close(releaseFirst) }) }
  t.Cleanup(releaseCallback)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()
  select {
  case <-firstStarted:
  case <-time.After(2 * time.Second):
    t.Fatal("first plugin diagnostic run did not start")
  }
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()
  body := h.recvEditor()
  if !strings.Contains(string(body), "new") || strings.Contains(string(body), "old") {
    t.Fatalf("expected only newest diagnostics, got:\n%s", body)
  }
  var publication struct {
    Method string `json:"method"`
    Params struct {
      URI string `json:"uri"`
      Diagnostics []struct {
        Message string `json:"message"`
      } `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &publication); err != nil {
    t.Fatalf("newest diagnostic publication is not JSON: %v", err)
  }
  if publication.Method != "textDocument/publishDiagnostics" || publication.Params.URI != "file:///a.ts" || len(publication.Params.Diagnostics) != 1 || publication.Params.Diagnostics[0].Message != "new" {
    t.Fatalf("newest publication did not contain only the new finding:\n%s", body)
  }
  releaseCallback()
  h.expectNoEditorFrame(150 * time.Millisecond)
}
