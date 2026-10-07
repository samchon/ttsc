package driver_test

import (
  "fmt"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidOpenDirtyTextSuppressesPluginDiagnostics Verifies restored
// editor buffers are compared with disk before plugin diagnostics run.
//
// LSP `didOpen` can carry unsaved text restored by the editor. Native plugin
// sidecars read files from disk, so a `didOpen` whose text differs from disk is
// dirty even before any `didChange` notification arrives.
//
// 1. Write saved disk text for a file URI.
// 2. Open the document with different LSP buffer text.
// 3. Assert the open reaches upstream and no plugin diagnostic is published.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards the dirty didOpen bytes unchanged and emits no editor frame during the 150ms observation window.
// @evidence contracts/testing.md#independent-expectations The buffer const dirty differs from authored const saved on disk, so saved-file plugin diagnostics must not be published for that buffer.
// @evidence contracts/testing.md#distinguishing-cases A restored dirty buffer before didChange is the distinguishing input; absence is bounded by the no-frame window, not a proof for arbitrary delays.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the proxy over pipes with an actual disk fixture and stub diagnostics, without a native sidecar.
func TestLSPProxyDidOpenDirtyTextSuppressesPluginDiagnostics(t *testing.T) {
  uri := writeLSPDiskFile(t, "const saved = 1;\n")
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      uri: {{Source: "ttsc/lint", Message: "saved-file lint"}},
    },
  }
  h := newProxyHarness(t, source)

  didOpen := []byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"const dirty = 1;\n"}}}`, uri))
  h.sendEditor(didOpen)
  if got := h.recvUpstream(); string(got) != string(didOpen) {
    t.Fatalf("didOpen was not forwarded:\ngot:  %s\nwant: %s", got, didOpen)
  }
  h.expectNoEditorFrame(150 * time.Millisecond)
}
