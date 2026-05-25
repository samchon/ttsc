package driver_test

import (
  "fmt"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsStaleAsyncPluginDiagnostics verifies slow plugin
// diagnostics are not relabelled with a newer upstream document version.
//
// Plugin diagnostics run asynchronously so upstream TypeScript diagnostics can
// flow immediately. If a version-1 plugin run completes after upstream has
// already published version 2, the proxy must drop the stale result instead of
// publishing it as version 2.
//
// 1. Block a plugin diagnostic run for `didOpen` version 1.
// 2. Publish upstream diagnostics for version 2.
// 3. Release the stale plugin run.
// 4. Assert no stale plugin publish reaches the editor.
func TestLSPProxyDropsStaleAsyncPluginDiagnostics(t *testing.T) {
  release := make(chan struct{})
  source := &stubSource{
    diagnosticsFor: func(doc driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      if doc.Version != nil && *doc.Version == 1 {
        <-release
        return []driver.LSPDiagnostic{{Source: "ttsc/lint", Message: "stale"}}
      }
      return nil
    },
  }
  h := newProxyHarness(t, source)

  uri := writeLSPDiskFile(t, "export {};")
  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"export {};"}}}`, uri)))
  _ = h.recvUpstream()
  upstream := []byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":%q,"version":2,"diagnostics":[]}}`, uri))
  h.sendUpstream(upstream)
  _ = h.recvEditor()
  close(release)
  h.expectNoEditorFrame(150 * time.Millisecond)
}
