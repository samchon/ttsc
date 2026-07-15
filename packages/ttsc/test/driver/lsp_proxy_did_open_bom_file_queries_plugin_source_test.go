package driver_test

import (
  "encoding/json"
  "fmt"
  "net/url"
  "os"
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDidOpenBOMFileQueriesPluginSource verifies a file whose disk copy
// starts with a UTF-8 BOM is classified clean on didOpen when the editor sends
// BOM-less buffer text, so plugin diagnostics are not suppressed until the first
// save (#621).
//
// The proxy gates plugin diagnostics on the buffer matching disk. A raw byte
// compare treats a BOM present only on disk as an edit, marking the unedited
// file dirty and short-circuiting the plugin pipeline. Stripping a leading BOM
// from both sides restores the clean classification.
//
// 1. Write disk text that begins with a UTF-8 BOM.
// 2. didOpen the document with the same text minus the BOM.
// 3. Assert the plugin source is queried and its diagnostic reaches the editor.
func TestLSPProxyDidOpenBOMFileQueriesPluginSource(t *testing.T) {
  const content = "const saved = 1;\n"
  uri := writeLSPDiskFileWithBOM(t, content)

  queried := make(chan struct{}, 1)
  source := &stubSource{
    diagnosticsFor: func(driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      select {
      case queried <- struct{}{}:
      default:
      }
      return []driver.LSPDiagnostic{{Source: "ttsc/lint", Message: "bom-file lint"}}
    },
  }
  h := newProxyHarness(t, source)

  didOpen := []byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":%q}}}`, uri, content))
  h.sendEditor(didOpen)
  if got := h.recvUpstream(); string(got) != string(didOpen) {
    t.Fatalf("didOpen was not forwarded verbatim:\ngot:  %s\nwant: %s", got, didOpen)
  }

  // A clean classification publishes the plugin diagnostic; a dirty one would
  // suppress it entirely on the first open.
  body := h.recvEditor()
  var decoded struct {
    Params struct {
      Diagnostics []json.RawMessage `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("publish not JSON: %v\n%s", err, body)
  }
  if len(decoded.Params.Diagnostics) == 0 {
    t.Fatalf("BOM file was classified dirty; plugin diagnostics suppressed:\n%s", body)
  }
  select {
  case <-queried:
  default:
    t.Fatal("plugin source was not queried for the BOM'd file")
  }
}

// writeLSPDiskFileWithBOM writes text prefixed with a UTF-8 BOM to a temp file
// and returns its file:// uri, mirroring writeLSPDiskFile.
func writeLSPDiskFileWithBOM(t *testing.T, text string) string {
  t.Helper()
  file := filepath.Join(t.TempDir(), "source.ts")
  if err := os.WriteFile(file, []byte("\uFEFF"+text), 0o644); err != nil {
    t.Fatal(err)
  }
  uriPath := filepath.ToSlash(file)
  if filepath.VolumeName(file) != "" && uriPath[0] != '/' {
    uriPath = "/" + uriPath
  }
  return (&url.URL{Scheme: "file", Path: uriPath}).String()
}
