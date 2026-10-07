package driver_test

import (
  "encoding/json"
  "fmt"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyPublishesProjectDiagnosticsOnlyAtConfigURI Verifies that two source opens publish project findings only at the unversioned config URI with zero-width ranges.
//
// Two source documents supply the same project finding, followed by a bounded extra-publication silence check.
//
// 1. Open two clean source documents whose plugin document sets are empty.
// 2. Return the same project finding for the logical config URI both times.
// 3. Assert both publications target only the config URI and carry no version.
//
// @evidence contracts/testing.md#behavioral-verification Two source opens publish project findings only at the unversioned config URI with zero-width ranges.
// @evidence contracts/testing.md#independent-expectations Project results belong to the config URI and config-start range rather than source URIs.
// @evidence contracts/testing.md#distinguishing-cases Two source documents supply the same project finding, followed by a bounded extra-publication silence check.
// @evidence contracts/testing.md#execution-ownership The fixed project stub and private Go proxy pipes exercise publication policy. Go discovers TestLSPProxyPublishesProjectDiagnosticsOnlyAtConfigURI under ./test/driver.
func TestLSPProxyPublishesProjectDiagnosticsOnlyAtConfigURI(t *testing.T) {
  const configURI = "file:///logical/project/tsconfig.json"
  source := &stubSource{
    diagnosticsResultFor: func(driver.LSPDocumentVersion) driver.LSPDiagnosticsResult {
      return driver.LSPDiagnosticsResult{Project: &driver.LSPProjectDiagnostics{
        URI: configURI,
        Diagnostics: []driver.LSPDiagnostic{{
          Code:     "demo/project",
          Source:   "@ttsc/lint",
          Severity: driver.LSPDiagnosticSeverityError,
          Message:  "project rejected",
          Range: driver.LSPRange{
            Start: driver.LSPPosition{Line: 4, Character: 2},
            End:   driver.LSPPosition{Line: 5, Character: 3},
          },
        }},
      }}
    },
  }
  h := newProxyHarness(t, source)

  for version, content := range []string{"export const a = 1;", "export const b = 2;"} {
    uri := writeLSPDiskFile(t, content)
    h.sendEditor([]byte(fmt.Sprintf(
      `{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":%d,"languageId":"typescript","text":%q}}}`,
      uri,
      version+1,
      content,
    )))
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
      t.Fatalf("project publication is not JSON: %v\n%s", err, body)
    }
    if decoded.Params.URI != configURI || decoded.Params.Version != nil || len(decoded.Params.Diagnostics) != 1 {
      t.Fatalf("project diagnostic should publish only at unversioned config URI: %s", body)
    }
    var diagnostic driver.LSPDiagnostic
    if err := json.Unmarshal(decoded.Params.Diagnostics[0], &diagnostic); err != nil {
      t.Fatal(err)
    }
    if diagnostic.Range.Start != (driver.LSPPosition{}) || diagnostic.Range.End != (driver.LSPPosition{}) {
      t.Fatalf("project range should be zero-width at the config start: %#v", diagnostic.Range)
    }
  }
  h.expectNoEditorFrame(100 * time.Millisecond)
}
