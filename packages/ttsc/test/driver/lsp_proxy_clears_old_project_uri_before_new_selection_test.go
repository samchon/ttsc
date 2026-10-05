package driver_test

import (
  "encoding/json"
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsOldProjectURIBeforeNewSelection verifies the proxy emits
// an empty old-config publication before the new selected-config finding.
// The case observes ordered frames, not an editor's retained problem state.
//
// The proxy must clear the prior URI before publishing the replacement set at
// the new logical config URI. (Whether the publications carry a version is
// not examined here; TestLSPProxyClearsCleanProjectPublication checks it.)
//
//  1. Publish a project finding at the first config URI.
//  2. Re-evaluate with a second config URI.
//  3. Assert the old empty frame precedes the new diagnostic frame.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run clears the old config before publishing one new finding.
// @evidence contracts/testing.md#independent-expectations The independently supplied old/new URIs establish the ordered replacement contract.
// @evidence contracts/testing.md#distinguishing-cases URI change checks counts/order; message contents and versions are not asserted.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyClearsOldProjectURIBeforeNewSelection in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
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
  initial := decodeProjectPublishForSelectionTest(t, h.recvEditor())
  if initial.URI != oldURI || len(initial.Diagnostics) != 1 {
    t.Fatalf("old config must first receive a project finding: %#v", initial)
  }

  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":%q,"version":2}}}`, uri)))
  // Upstream forwarding and asynchronous editor publication are independent
  // streams. Drain the ordered editor pair first instead of imposing an
  // unsupported cross-stream ordering on the proxy.
  oldClear := decodeProjectPublishForSelectionTest(t, h.recvEditor())
  replacement := decodeProjectPublishForSelectionTest(t, h.recvEditor())
  _ = h.recvUpstream()
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
    Method string                         `json:"method"`
    Params projectPublishForSelectionTest `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("project publication is not JSON: %v\n%s", err, body)
  }
  if decoded.Method != "textDocument/publishDiagnostics" {
    t.Fatalf("expected a diagnostic publication: %s", body)
  }
  return decoded.Params
}
