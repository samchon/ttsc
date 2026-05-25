package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidSaveVersionlessAfterDirtyDropsOlderUpstream verifies dirty
// upstream diagnostics are cached only for the latest dirty version.
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
}
