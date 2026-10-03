package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyHandlesPluginOnlyCodeActionWithoutUpstreamProvider Verifies that plugin-only code actions remain local when upstream advertises no action provider.
//
// Initialize false precedes the source.fixAll.ttsc request.
//
// 1. Initialize with `codeActionProvider: false`.
// 2. Send a source.fixAll.ttsc codeAction request.
// 3. Assert it is not forwarded upstream and the editor receives the plugin action.
//
// @evidence contracts/testing.md#behavioral-verification Plugin-only code actions remain local when upstream advertises no action provider.
// @evidence contracts/testing.md#independent-expectations The explicit only kind belongs to the plugin; its fixed action title defines the result.
// @evidence contracts/testing.md#distinguishing-cases Initialize false precedes the source.fixAll.ttsc request.
// @evidence contracts/testing.md#execution-ownership The Go proxy harness observes the local action and 150 milliseconds of upstream silence. Go discovers TestLSPProxyHandlesPluginOnlyCodeActionWithoutUpstreamProvider under ./test/driver.
func TestLSPProxyHandlesPluginOnlyCodeActionWithoutUpstreamProvider(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    actions:  []driver.LSPCodeAction{{Title: "Fix all", Kind: "source.fixAll.ttsc"}},
    commands: []string{"ttsc.lint.fixAll"},
  })
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":false}}}`))
  _ = h.recvEditor()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.fixAll.ttsc"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  body := h.recvEditor()
  var decoded struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, body)
  }
  if len(decoded.Result) != 1 || decoded.Result[0].Title != "Fix all" {
    t.Fatalf("plugin-only response mismatch: %#v", decoded.Result)
  }
}
