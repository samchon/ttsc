package driver_test

import (
  "fmt"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidOpenDirtyTextSuppressesPluginDiagnostics verifies restored
// editor buffers are compared with disk before plugin diagnostics run.
//
// LSP `didOpen` can carry unsaved text restored by the editor. Native plugin
// sidecars read files from disk, so a `didOpen` whose text differs from disk is
// dirty even before any `didChange` notification arrives.
//
// 1. Write saved disk text for a file URI.
// 2. Open the document with different LSP buffer text.
// 3. Assert the open reaches upstream and no plugin diagnostic is published.
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
