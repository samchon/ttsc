package driver_test

import (
  "fmt"
  "strings"
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyRejectsStaleAsyncProjectPublication Verifies the project
// generation spans diagnostic requests for different source documents and is
// invalidated when the initiating document becomes dirty.
//
// Per-document generations cannot reject an older project result from another
// URI. The latest project evaluation owns one global generation, so a slow
// earlier request must not overwrite its config publication after completing.
//
//  1. Block the first document's project evaluation.
//  2. Publish a newer project result from a second document.
//  3. Release the old result and observe no editor frame for 150 milliseconds.
//  4. Block another evaluation, dirty its document, and reject that result too.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run publishes newer project work and suppresses old or dirtied work during 150ms windows.
// @evidence contracts/testing.md#independent-expectations Channels hold work until newer results or explicit edits establish stale generations.
// @evidence contracts/testing.md#distinguishing-cases Different-document replacement and dirty-document invalidation are both covered; windows are bounded.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyRejectsStaleAsyncProjectPublication in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyRejectsStaleAsyncProjectPublication(t *testing.T) {
  const configURI = "file:///logical/project/tsconfig.json"
  entered := make(chan struct{})
  release := make(chan struct{})
  var releaseCallbackOnce sync.Once
  releaseCallback := func() { releaseCallbackOnce.Do(func() { close(release) }) }
  t.Cleanup(releaseCallback)
  defer releaseCallback()
  var calls atomic.Int32
  source := &stubSource{
    diagnosticsResultFor: func(driver.LSPDocumentVersion) driver.LSPDiagnosticsResult {
      call := calls.Add(1)
      message := "new project"
      if call == 1 {
        close(entered)
        <-release
        message = "stale project"
      }
      return driver.LSPDiagnosticsResult{Project: &driver.LSPProjectDiagnostics{
        URI:         configURI,
        Diagnostics: []driver.LSPDiagnostic{{Message: message}},
      }}
    },
  }
  h := newProxyHarness(t, source)
  firstURI := writeLSPDiskFile(t, "export const first = 1;\n")
  secondURI := writeLSPDiskFile(t, "export const second = 2;\n")

  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"export const first = 1;\n"}}}`, firstURI)))
  _ = h.recvUpstream()
  select {
  case <-entered:
  case <-time.After(2 * time.Second):
    t.Fatal("first project evaluation did not start")
  }
  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"export const second = 2;\n"}}}`, secondURI)))
  _ = h.recvUpstream()
  if body := h.recvEditor(); !strings.Contains(string(body), "new project") || strings.Contains(string(body), "stale project") {
    t.Fatalf("new project result should publish first: %s", body)
  }
  releaseCallback()
  h.expectNoEditorFrame(150 * time.Millisecond)

  dirtyEntered := make(chan struct{})
  dirtyRelease := make(chan struct{})
  var releaseDirtyCallbackOnce sync.Once
  releaseDirtyCallback := func() { releaseDirtyCallbackOnce.Do(func() { close(dirtyRelease) }) }
  t.Cleanup(releaseDirtyCallback)
  defer releaseDirtyCallback()
  dirtySource := &stubSource{
    diagnosticsResultFor: func(driver.LSPDocumentVersion) driver.LSPDiagnosticsResult {
      close(dirtyEntered)
      <-dirtyRelease
      return driver.LSPDiagnosticsResult{Project: &driver.LSPProjectDiagnostics{
        URI:         configURI,
        Diagnostics: []driver.LSPDiagnostic{{Message: "dirty project"}},
      }}
    },
  }
  dirtyHarness := newProxyHarness(t, dirtySource)
  dirtyURI := writeLSPDiskFile(t, "export const clean = 1;\n")
  dirtyHarness.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"export const clean = 1;\n"}}}`, dirtyURI)))
  _ = dirtyHarness.recvUpstream()
  select {
  case <-dirtyEntered:
  case <-time.After(2 * time.Second):
    t.Fatal("dirty project evaluation did not start")
  }
  dirtyHarness.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":%q,"version":2},"contentChanges":[{"text":"export const dirty = 2;\n"}]}}`, dirtyURI)))
  _ = dirtyHarness.recvUpstream()
  releaseDirtyCallback()
  dirtyHarness.expectNoEditorFrame(150 * time.Millisecond)
}
