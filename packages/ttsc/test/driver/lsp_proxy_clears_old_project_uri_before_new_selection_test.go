package driver_test

import (
  "encoding/json"
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsOldProjectURIBeforeNewSelection verifies changing selected
// configs cannot leave an orphaned project problem in the editor.
//
// The proxy must clear the prior URI before publishing the replacement set at
// the new logical config URI. Both publications are unversioned because config
// files are not the requested source document.
//
//  1. Publish a project finding at the first config URI.
//  2. Re-evaluate with a second config URI.
//  3. Assert the old empty frame precedes the new diagnostic frame.
func TestLSPProxyClearsOldProjectURIBeforeNewSelection(t *testing.T) {
  const oldURI = "file:///logical/old/tsconfig.json"
  const newURI = "file:///logical/new/tsconfig.json"
  calls := 0
  source := &stubSource{
    diagnosticsResultFor: func(driver.LSPDocumentVersion) driver.LSPDiagnosticsResult {
      calls++
      uri := oldURI
      message := "old project"
      if calls > 1 {
        uri = newURI
        message = "new project"
      }
      return driver.LSPDiagnosticsResult{Project: &driver.LSPProjectDiagnostics{
        URI:         uri,
        Diagnostics: []driver.LSPDiagnostic{{Message: message}},
      }}
    },
  }
  h := newProxyHarness(t, source)
  uri := writeLSPDiskFile(t, "export {};\n")
  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"export {};\n"}}}`, uri)))
  _ = h.recvUpstream()
  _ = h.recvEditor()

  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":%q,"version":2}}}`, uri)))
  _ = h.recvUpstream()
  oldClear := decodeProjectPublishForSelectionTest(t, h.recvEditor())
  replacement := decodeProjectPublishForSelectionTest(t, h.recvEditor())
  if oldClear.URI != oldURI || len(oldClear.Diagnostics) != 0 {
    t.Fatalf("old config should be cleared first: %#v", oldClear)
  }
  if replacement.URI != newURI || len(replacement.Diagnostics) != 1 {
    t.Fatalf("new config should receive the replacement finding: %#v", replacement)
  }
}

type projectPublishForSelectionTest struct {
  URI         string            `json:"uri"`
  Diagnostics []json.RawMessage `json:"diagnostics"`
}

func decodeProjectPublishForSelectionTest(t *testing.T, body []byte) projectPublishForSelectionTest {
  t.Helper()
  var decoded struct {
    Params projectPublishForSelectionTest `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("project publication is not JSON: %v\n%s", err, body)
  }
  return decoded.Params
}
