package driver_test

import (
  "fmt"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidOpenForwardsBeforePluginDiagnostics Verifies that didOpen reaches upstream while its diagnostics callback remains blocked.
//
// The 200-millisecond observation detects notification blocking, without checking plugin publication completion.
//
// 1. Configure a source whose Diagnostics blocks.
// 2. Send `textDocument/didOpen` from the editor.
// 3. Assert upstream receives the notification within a short window.
//
// @evidence contracts/testing.md#behavioral-verification didOpen reaches upstream while its diagnostics callback remains blocked.
// @evidence contracts/testing.md#independent-expectations The authored notification must be forwarded before the channel-blocked callback can finish.
// @evidence contracts/testing.md#distinguishing-cases The 200-millisecond observation detects notification blocking, without checking plugin publication completion.
// @evidence contracts/testing.md#execution-ownership A channel-controlled Go source and io.Pipe proxy execute the ordering case; deferred release unblocks cleanup. Go discovers TestLSPProxyDidOpenForwardsBeforePluginDiagnostics under ./test/driver.
func TestLSPProxyDidOpenForwardsBeforePluginDiagnostics(t *testing.T) {
  release := make(chan struct{})
  source := &stubSource{
    diagnosticsFor: func(driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      <-release
      return []driver.LSPDiagnostic{{Message: "plugin"}}
    },
  }
  h := newProxyHarness(t, source)
  defer close(release)

  uri := writeLSPDiskFile(t, "export {};")
  didOpen := []byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"export {};"}}}`, uri))
  h.sendEditor(didOpen)

  type result struct {
    body []byte
    err  error
  }
  ch := make(chan result, 1)
  go func() {
    _, body, err := h.upstreamInFR.Read()
    ch <- result{body: body, err: err}
  }()
  select {
  case got := <-ch:
    if got.err != nil {
      t.Fatalf("upstream read failed: %v", got.err)
    }
    if string(got.body) != string(didOpen) {
      t.Fatalf("upstream didOpen mismatch:\n%s", got.body)
    }
  case <-time.After(200 * time.Millisecond):
    t.Fatal("didOpen was blocked by plugin diagnostics")
  }
}
