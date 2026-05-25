package driver_test

import (
  "bytes"
  "encoding/json"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesDirtyDocumentPluginDiagnostics verifies plugin
// diagnostics do not run against unsaved editor buffers.
//
// Native plugin sidecars currently reload files from disk. After a didChange,
// publishing plugin diagnostics would stamp saved-file findings onto the live
// editor version, so the proxy must forward upstream diagnostics alone until a
// save or fresh open makes the disk snapshot authoritative again.
//
// 1. Publish and observe an initial merged plugin diagnostic.
// 2. Mark the document dirty with didChange.
// 3. Publish upstream diagnostics for the dirty version.
// 4. Assert no plugin follow-up frame is sent.
func TestLSPProxySuppressesDirtyDocumentPluginDiagnostics(t *testing.T) {
  source := &stubSource{
    diagnostics: map[string][]driver.LSPDiagnostic{
      "file:///a.ts": {{
        Range:   driver.LSPRange{Start: driver.LSPPosition{Line: 1}, End: driver.LSPPosition{Line: 1, Character: 1}},
        Source:  "ttsc/lint",
        Message: "saved-file lint",
      }},
    },
  }
  h := newProxyHarness(t, source)

  first := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","version":1,"diagnostics":[]}}`)
  h.sendUpstream(first)
  if got := h.recvEditor(); !bytes.Equal(got, first) {
    t.Fatalf("initial upstream diagnostics mismatch:\ngot:  %s\nwant: %s", got, first)
  }
  if body := h.recvEditor(); !strings.Contains(string(body), "saved-file lint") {
    t.Fatalf("initial plugin diagnostic missing:\n%s", body)
  }

  didChange := []byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty = 1;"}]}}`)
  h.sendEditor(didChange)
  clear := h.recvEditor()
  var clearFrame struct {
    Params struct {
      Diagnostics []json.RawMessage `json:"diagnostics"`
      Version     *int              `json:"version,omitempty"`
    } `json:"params"`
  }
  if err := json.Unmarshal(clear, &clearFrame); err != nil {
    t.Fatalf("dirty clear frame not JSON: %v\n%s", err, clear)
  }
  if clearFrame.Params.Version == nil || *clearFrame.Params.Version != 2 {
    t.Fatalf("dirty clear frame version mismatch: %#v in %s", clearFrame.Params.Version, clear)
  }
  if len(clearFrame.Params.Diagnostics) != 0 {
    t.Fatalf("dirty clear frame kept diagnostics: %s", clear)
  }
  if got := h.recvUpstream(); !bytes.Equal(got, didChange) {
    t.Fatalf("didChange was not forwarded:\ngot:  %s\nwant: %s", got, didChange)
  }

  dirty := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///a.ts","version":2,"diagnostics":[{"message":"tsgo dirty"}]}}`)
  h.sendUpstream(dirty)
  if got := h.recvEditor(); !bytes.Equal(got, dirty) {
    t.Fatalf("dirty upstream diagnostics mismatch:\ngot:  %s\nwant: %s", got, dirty)
  }
  h.expectNoEditorFrame(150 * time.Millisecond)
}
