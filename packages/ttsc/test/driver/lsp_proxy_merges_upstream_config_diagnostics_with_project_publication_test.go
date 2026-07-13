package driver_test

import (
  "bytes"
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyMergesUpstreamConfigDiagnosticsWithProjectPublication verifies a
// project finding does not replace TypeScript diagnostics already cached for
// the selected config URI.
//
// Config files can receive upstream parse/config diagnostics. The project
// publication shares that URI, so the proxy must merge both sets while keeping
// the upstream notification's original frame and ordering intact.
//
//  1. Cache one upstream diagnostic at the logical config URI.
//  2. Return one project diagnostic for the same URI.
//  3. Assert the replacement publication contains both entries.
func TestLSPProxyMergesUpstreamConfigDiagnosticsWithProjectPublication(t *testing.T) {
  const configURI = "file:///logical/project/tsconfig.json"
  source := &stubSource{
    diagnosticsResultFor: func(driver.LSPDocumentVersion) driver.LSPDiagnosticsResult {
      return driver.LSPDiagnosticsResult{Project: &driver.LSPProjectDiagnostics{
        URI:         configURI,
        Diagnostics: []driver.LSPDiagnostic{{Message: "project rejected"}},
      }}
    },
  }
  h := newProxyHarness(t, source)
  upstream := []byte(`{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///logical/project/tsconfig.json","diagnostics":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"severity":1,"message":"invalid config"}]}}`)
  h.sendUpstream(upstream)
  if got := h.recvEditor(); !bytes.Equal(got, upstream) {
    t.Fatalf("upstream config diagnostics were not forwarded first:\ngot: %s\nwant: %s", got, upstream)
  }
  body := h.recvEditor()
  var decoded struct {
    Params struct {
      URI         string            `json:"uri"`
      Version     *int              `json:"version,omitempty"`
      Diagnostics []json.RawMessage `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("merged project publication is not JSON: %v\n%s", err, body)
  }
  if decoded.Params.URI != configURI || decoded.Params.Version != nil || len(decoded.Params.Diagnostics) != 2 {
    t.Fatalf("project publication should merge the cached upstream set: %s", body)
  }
}
