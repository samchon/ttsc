package driver_test

import (
  "encoding/json"
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsStalePluginDiagnostics Verifies a later empty plugin result
// clears diagnostics the proxy published earlier for the same URI.
//
// LSP publishDiagnostics replaces the whole diagnostic set for a URI. When a
// plugin finding disappears and upstream has no new diagnostics to merge, the
// proxy still has to publish an empty diagnostic array so editors remove the
// previous ttsc squiggle.
//
// 1. Return one plugin diagnostic for `didOpen`.
// 2. Return no plugin diagnostics for `didSave`.
// 3. Assert the second plugin publish carries an empty diagnostics array.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run publishes a finding on didOpen and an empty diagnostic array on didSave after the stub returns no findings.
// @evidence contracts/testing.md#independent-expectations LSP publications replace the prior set for a URI; an empty second result must clear the first literal finding.
// @evidence contracts/testing.md#distinguishing-cases The literal first finding and same-URI empty-array replacement distinguish populated-to-empty publication from absent or null diagnostics.
// @evidence contracts/testing.md#execution-ownership Go test/driver uses a saved temporary file and in-process pipe proxy with successive stub diagnostic results.
func TestLSPProxyClearsStalePluginDiagnostics(t *testing.T) {
  call := 0
  source := &stubSource{
    diagnosticsFor: func(driver.LSPDocumentVersion) []driver.LSPDiagnostic {
      call++
      if call == 1 {
        return []driver.LSPDiagnostic{{Source: "ttsc/lint", Message: "first"}}
      }
      return nil
    },
  }
  h := newProxyHarness(t, source)

  uri := writeLSPDiskFile(t, "var a=1;")
  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":%q,"version":1,"languageId":"typescript","text":"var a=1;"}}}`, uri)))
  _ = h.recvUpstream()
  firstBody := h.recvEditor()
  var first struct {
    Method string `json:"method"`
    Params struct {
      URI         string `json:"uri"`
      Diagnostics []struct {
        Source  string `json:"source"`
        Message string `json:"message"`
      } `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(firstBody, &first); err != nil {
    t.Fatalf("initial plugin publication is not JSON: %v", err)
  }
  if first.Method != "textDocument/publishDiagnostics" || first.Params.URI != uri || len(first.Params.Diagnostics) != 1 || first.Params.Diagnostics[0].Source != "ttsc/lint" || first.Params.Diagnostics[0].Message != "first" {
    t.Fatalf("initial plugin finding was not published:\n%s", firstBody)
  }

  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":%q,"version":2}}}`, uri)))
  _ = h.recvUpstream()
  body := h.recvEditor()
  var decoded struct {
    Method string `json:"method"`
    Params struct {
      URI         string            `json:"uri"`
      Diagnostics []json.RawMessage `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("clear publish not JSON: %v\n%s", err, body)
  }
  if got := len(decoded.Params.Diagnostics); got != 0 {
    t.Fatalf("expected plugin diagnostics to clear, got %d entries in %s", got, body)
  }
  if decoded.Method != "textDocument/publishDiagnostics" || decoded.Params.URI != uri || decoded.Params.Diagnostics == nil {
    t.Fatalf("clear must publish an explicit empty array for the same URI: %s", body)
  }
}
