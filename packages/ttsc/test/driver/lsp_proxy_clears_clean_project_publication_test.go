package driver_test

import (
  "encoding/json"
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsCleanProjectPublication Verifies that the proxy replaces a prior project finding with an empty unversioned config publication.
//
// The first callback publishes a finding and the second is clean while document findings remain absent.
//
// 1. Publish one project finding during didOpen.
// 2. Return an empty project set during didSave.
// 3. Assert the config URI receives an empty replacement publication.
//
// @evidence contracts/testing.md#behavioral-verification The proxy replaces a prior project finding with an empty unversioned config publication.
// @evidence contracts/testing.md#independent-expectations LSP publications replace the full URI set, so an explicitly empty project set clears the finding.
// @evidence contracts/testing.md#distinguishing-cases The first callback publishes a finding and the second is clean while document findings remain absent.
// @evidence contracts/testing.md#execution-ownership Two notifications drive the actual Go proxy and stub through private pipes. Go discovers TestLSPProxyClearsCleanProjectPublication under ./test/driver.
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
  firstBody := h.recvEditor()
  var first struct {
    Method string `json:"method"`
    Params struct {
      URI         string `json:"uri"`
      Version     *int   `json:"version,omitempty"`
      Diagnostics []struct {
        Message string `json:"message"`
      } `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(firstBody, &first); err != nil {
    t.Fatalf("initial project publication is not JSON: %v", err)
  }
  if first.Method != "textDocument/publishDiagnostics" || first.Params.URI != configURI || first.Params.Version != nil || len(first.Params.Diagnostics) != 1 || first.Params.Diagnostics[0].Message != "project rejected" {
    t.Fatalf("initial project finding was not published:\n%s", firstBody)
  }

  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":%q,"version":2}}}`, uri)))
  body := h.recvEditor()
  _ = h.recvUpstream()
  var decoded struct {
    Method string `json:"method"`
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
  if decoded.Method != "textDocument/publishDiagnostics" {
    t.Fatalf("clean project result is not a diagnostic publication: %s", body)
  }
}
