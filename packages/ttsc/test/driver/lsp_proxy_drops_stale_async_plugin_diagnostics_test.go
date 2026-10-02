package driver_test

import (
  "fmt"
  "sync"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsStaleAsyncPluginDiagnostics Verifies slow plugin
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
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards version 2 and sends no stale follow-up during 150ms.
// @evidence contracts/testing.md#independent-expectations Authored versions 1 then 2 establish stale ownership.
// @evidence contracts/testing.md#distinguishing-cases Blocked older work contrasts with newer upstream publication; the silence observation is bounded.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyDropsStaleAsyncPluginDiagnostics in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyDropsStaleAsyncPluginDiagnostics(t *testing.T) {
  release := make(chan struct{})
  var releaseCallbackOnce sync.Once
  releaseCallback := func() { releaseCallbackOnce.Do(func() { close(release) }) }
  t.Cleanup(releaseCallback)
  defer releaseCallback()
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
  releaseCallback()
  h.expectNoEditorFrame(150 * time.Millisecond)
}
