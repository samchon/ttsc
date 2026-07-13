package driver_test

import (
  "encoding/json"
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsCleanProjectPublication verifies a project finding is
// removed when the next evaluation becomes clean.
//
// LSP diagnostics replace the full set for a URI. An explicit empty project
// result therefore has to produce an empty, unversioned config publication
// even when the requested source document never had plugin diagnostics.
//
//  1. Publish one project finding during didOpen.
//  2. Return an empty project set during didSave.
//  3. Assert the config URI receives an empty replacement publication.
func TestLSPProxyClearsCleanProjectPublication(t *testing.T) {
  const configURI = "file:///logical/project/tsconfig.json"
  calls := 0
  source := &stubSource{
    diagnosticsResultFor: func(driver.LSPDocumentVersion) driver.LSPDiagnosticsResult {
      calls++
      project := &driver.LSPProjectDiagnostics{URI: configURI}
      if calls == 1 {
        project.Diagnostics = []driver.LSPDiagnostic{{Message: "project rejected"}}
      }
      return driver.LSPDiagnosticsResult{Project: project}
    },
  }
  h := newProxyHarness(t, source)
  uri := writeLSPDiskFile(t, "export {};\n")
  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"export {};\n"}}}`, uri)))
  _ = h.recvUpstream()
  _ = h.recvEditor()

  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":%q,"version":2}}}`, uri)))
  _ = h.recvUpstream()
  body := h.recvEditor()
  var decoded struct {
    Params struct {
      URI         string            `json:"uri"`
      Version     *int              `json:"version,omitempty"`
      Diagnostics []json.RawMessage `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("clean project publication is not JSON: %v\n%s", err, body)
  }
  if decoded.Params.URI != configURI || decoded.Params.Version != nil || len(decoded.Params.Diagnostics) != 0 {
    t.Fatalf("clean project should clear the unversioned config publication: %s", body)
  }
}
