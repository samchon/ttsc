package driver_test

import (
  "encoding/json"
  "fmt"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyClearsStalePluginDiagnostics verifies a later empty plugin result
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
  _ = h.recvEditor()

  h.sendEditor([]byte(fmt.Sprintf(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":%q,"version":2}}}`, uri)))
  _ = h.recvUpstream()
  body := h.recvEditor()
  var decoded struct {
    Params struct {
      Diagnostics []json.RawMessage `json:"diagnostics"`
    } `json:"params"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("clear publish not JSON: %v\n%s", err, body)
  }
  if got := len(decoded.Params.Diagnostics); got != 0 {
    t.Fatalf("expected plugin diagnostics to clear, got %d entries in %s", got, body)
  }
}
