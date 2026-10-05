package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidSaveVersionlessAfterDirtyDropsOlderUpstream verifies that
// a version-2 upstream finding is excluded after dirty version 3 is saved
// without a version. Other dirty-version admission cases are not exercised.
//
// TypeScript-Go can publish diagnostics for an older dirty buffer after the
// editor has already sent a newer didChange. If the next didSave is versionless,
// the proxy cannot use version mismatch checks, so it must not retain that older
// upstream diagnostic while the document is dirty.
//
// 1. Mark a document dirty at version 2 and then version 3.
// 2. Receive an upstream diagnostic for stale version 2.
// 3. Send a versionless didSave.
// 4. Assert the plugin publish does not include the version-2 diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run excludes stale version-2 diagnostics from the plugin publication after dirty version 3 receives a versionless save.
// @evidence contracts/testing.md#independent-expectations Version 2 cannot describe the latest dirty version 3; the authored stale and fresh message literals distinguish the merged result.
// @evidence contracts/testing.md#distinguishing-cases Two dirty versions, an older upstream publication and a save without version exercise stale cache rejection before fresh plugin merge.
// @evidence contracts/testing.md#execution-ownership The Go test/driver pipe harness runs the proxy with authored frames and stub diagnostics, not an actual editor or TypeScript-Go server.
func TestLSPProxyDidSaveVersionlessAfterDirtyDropsOlderUpstream(t *testing.T) {
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      "file:///a.ts": {{Source: "ttsc/lint", Message: "fresh plugin"}},
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty = 2;"}]}}`))
  _ = h.recvUpstream()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":3},"contentChanges":[{"text":"const dirty = 3;"}]}}`))
  _ = h.recvUpstream()

  h.sendUpstream([]byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","version":2,"diagnostics":[{"message":"stale v2 tsgo"}]}}`))
  _ = h.recvEditor()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()
  body := h.recvEditor()
  if strings.Contains(string(body), "stale v2 tsgo") {
    t.Fatalf("versionless didSave merged stale dirty upstream diagnostics:\n%s", body)
  }
  if !strings.Contains(string(body), "fresh plugin") {
    t.Fatalf("versionless didSave missing plugin diagnostics:\n%s", body)
  }
  var publication struct {
    Method string `json:"method"`
    Params struct {
      URI         string `json:"uri"`
      Diagnostics []struct {
        Message string `json:"message"`
      } `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &publication); err != nil {
    t.Fatalf("saved plugin publication is not JSON: %v", err)
  }
  if publication.Method != "textDocument/publishDiagnostics" || publication.Params.URI != "file:///a.ts" || len(publication.Params.Diagnostics) != 1 || publication.Params.Diagnostics[0].Message != "fresh plugin" {
    t.Fatalf("save did not publish only the fresh plugin finding:\n%s", body)
  }
}
