package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidSaveVersionlessAfterDirtyIgnoresStaleUpstream Verifies that a versionless save after didChange publishes fresh plugin diagnostics without the prior upstream finding.
//
// Initial publication, dirty clearing, and versionless save form the asserted state chain.
//
// 1. Publish upstream and plugin diagnostics for version 1.
// 2. Mark the document dirty and observe the clearing frame.
// 3. Send a versionless didSave.
// 4. Assert the plugin publish does not include the stale upstream diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification A versionless save after didChange publishes fresh plugin diagnostics without the prior upstream finding.
// @evidence contracts/testing.md#independent-expectations A dirty transition invalidates diagnostics computed for the earlier generation.
// @evidence contracts/testing.md#distinguishing-cases Initial publication, dirty clearing, and versionless save form the asserted state chain.
// @evidence contracts/testing.md#execution-ownership A fixed Go stub and pipe proxy execute generation and cache behavior without a sidecar. Go discovers TestLSPProxyDidSaveVersionlessAfterDirtyIgnoresStaleUpstream under ./test/driver.
func TestLSPProxyDidSaveVersionlessAfterDirtyIgnoresStaleUpstream(t *testing.T) {
  type diagnosticPublication struct {
    Method string `json:"method"`
    Params struct {
      URI string `json:"uri"`
      Diagnostics []struct {
        Message string `json:"message"`
      } `json:"diagnostics"`
    } `json:"params"`
  }
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      "file:///a.ts": {{Source: "ttsc/lint", Message: "fresh plugin"}},
    },
  }
  h := newProxyHarness(t, source)

  upstream := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","version":1,"diagnostics":[{"message":"old tsgo"}]}}`)
  h.sendUpstream(upstream)
  if got := h.recvEditor(); !bytes.Equal(got, upstream) {
    t.Fatalf("initial upstream mismatch:\ngot:  %s\nwant: %s", got, upstream)
  }
  initialBody := h.recvEditor()
  if !strings.Contains(string(initialBody), "fresh plugin") {
    t.Fatalf("initial plugin publish missing:\n%s", initialBody)
  }
  var initial diagnosticPublication
  if err := json.Unmarshal(initialBody, &initial); err != nil {
    t.Fatalf("initial merged publication is not JSON: %v", err)
  }
  if initial.Method != "textDocument/publishDiagnostics" || initial.Params.URI != "file:///a.ts" || len(initial.Params.Diagnostics) != 2 || initial.Params.Diagnostics[0].Message != "old tsgo" || initial.Params.Diagnostics[1].Message != "fresh plugin" {
    t.Fatalf("initial merged finding baseline was not observed:\n%s", initialBody)
  }

  didChange := []byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty = 1;"}]}}`)
  h.sendEditor(didChange)
  clearBody := h.recvEditor()
  var cleared diagnosticPublication
  if err := json.Unmarshal(clearBody, &cleared); err != nil {
    t.Fatalf("dirty clearing publication is not JSON: %v", err)
  }
  if cleared.Method != "textDocument/publishDiagnostics" || cleared.Params.URI != "file:///a.ts" || cleared.Params.Diagnostics == nil || len(cleared.Params.Diagnostics) != 0 {
    t.Fatalf("dirty transition did not publish an empty same-URI array:\n%s", clearBody)
  }
  _ = h.recvUpstream()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()
  body := h.recvEditor()
  if strings.Contains(string(body), "old tsgo") {
    t.Fatalf("versionless didSave merged stale upstream diagnostics:\n%s", body)
  }
  if !strings.Contains(string(body), "fresh plugin") {
    t.Fatalf("versionless didSave missing plugin diagnostics:\n%s", body)
  }
  var saved diagnosticPublication
  if err := json.Unmarshal(body, &saved); err != nil {
    t.Fatalf("saved plugin publication is not JSON: %v", err)
  }
  if saved.Method != "textDocument/publishDiagnostics" || saved.Params.URI != "file:///a.ts" || len(saved.Params.Diagnostics) != 1 || saved.Params.Diagnostics[0].Message != "fresh plugin" {
    t.Fatalf("saved result did not contain only the fresh finding:\n%s", body)
  }
}
