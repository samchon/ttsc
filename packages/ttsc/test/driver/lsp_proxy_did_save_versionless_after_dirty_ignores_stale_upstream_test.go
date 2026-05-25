package driver_test

import (
  "bytes"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidSaveVersionlessAfterDirtyIgnoresStaleUpstream verifies dirty
// transitions clear cached upstream diagnostics.
//
// Some clients send versionless `didSave`. If the proxy kept pre-change
// upstream diagnostics after `didChange`, a save-triggered plugin publish would
// merge stale TypeScript diagnostics into the freshly saved plugin result.
//
// 1. Publish upstream and plugin diagnostics for version 1.
// 2. Mark the document dirty and observe the clearing frame.
// 3. Send a versionless didSave.
// 4. Assert the plugin publish does not include the stale upstream diagnostic.
func TestLSPProxyDidSaveVersionlessAfterDirtyIgnoresStaleUpstream(t *testing.T) {
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
  if body := h.recvEditor(); !strings.Contains(string(body), "fresh plugin") {
    t.Fatalf("initial plugin publish missing:\n%s", body)
  }

  didChange := []byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty = 1;"}]}}`)
  h.sendEditor(didChange)
  _ = h.recvEditor()
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
}
