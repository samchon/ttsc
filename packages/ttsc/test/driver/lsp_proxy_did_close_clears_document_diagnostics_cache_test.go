package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidCloseClearsDocumentDiagnosticsCache Verifies that didClose prevents a later versionless plugin publication from including old cached upstream diagnostics.
//
// Cached upstream data, close, and versionless save distinguish eviction from stale reuse.
//
// 1. Cache an upstream TypeScript diagnostic for `file:///a.ts`.
// 2. Send didClose for the same URI.
// 3. Send a versionless didSave that contributes one plugin diagnostic.
// 4. Assert the plugin publish does not include the old upstream diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification didClose prevents a later versionless plugin publication from including old cached upstream diagnostics.
// @evidence contracts/testing.md#independent-expectations Closing a document ends its prior diagnostic session; the stub independently supplies plugin.
// @evidence contracts/testing.md#distinguishing-cases Cached upstream data, close, and versionless save distinguish eviction from stale reuse.
// @evidence contracts/testing.md#execution-ownership The private Go pipe harness drives the actual proxy's diagnostic cache. Go discovers TestLSPProxyDidCloseClearsDocumentDiagnosticsCache under ./test/driver.
func TestLSPProxyDidCloseClearsDocumentDiagnosticsCache(t *testing.T) {
  source := &stubSource{
    diagnosticsFor: func(doc driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      if doc.Version != nil {
        return nil
      }
      return []driver.LSPDiagnostic{{Source: "ttsc/lint", Message: "plugin"}}
    },
  }
  h := newProxyHarness(t, source)

  h.sendUpstream([]byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","version":1,"diagnostics":[{"message":"old-tsgo"}]}}`))
  _ = h.recvEditor()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didClose","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts"}}}`))
  _ = h.recvUpstream()
  body := h.recvEditor()
  if !strings.Contains(string(body), "plugin") || strings.Contains(string(body), "old-tsgo") {
    t.Fatalf("didClose did not clear diagnostics cache:\n%s", body)
  }
}
