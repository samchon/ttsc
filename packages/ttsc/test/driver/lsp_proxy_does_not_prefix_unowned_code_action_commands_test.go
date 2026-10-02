package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDoesNotPrefixUnownedCodeActionCommands Verifies that the proxy preserves an unadvertised action command instead of adding its configured prefix.
//
// A plugin-only action contains a foreign command alongside a different owned command.
//
// 1. Configure a source that advertises one custom command.
// 2. Return a code action whose command id is not advertised by the source.
// 3. Request the plugin-only action kind.
// 4. Assert the unowned command is not prefixed in the editor response.
//
// @evidence contracts/testing.md#behavioral-verification The sole decoded action.command.command equals the literal tsgo.refactor.extract instead of a prefixed or unrelated ID.
// @evidence contracts/testing.md#independent-expectations Only source-advertised commands may be namespaced; the foreign literal is not advertised.
// @evidence contracts/testing.md#distinguishing-cases A plugin-only action contains a foreign command alongside a different owned command.
// @evidence contracts/testing.md#execution-ownership Explicit prefix options configure the Go pipe proxy, with local response and upstream silence observed. Go discovers TestLSPProxyDoesNotPrefixUnownedCodeActionCommands under ./test/driver.
func TestLSPProxyDoesNotPrefixUnownedCodeActionCommands(t *testing.T) {
  const prefix = "ttsc.vscode.root."
  h := newProxyHarnessWithOptions(t, &stubSource{
    actions: []driver.LSPCodeAction{{
      Title: "Foreign fix",
      Kind:  "source.custom.ttsc",
      Command: &driver.LSPCommand{
        Title:   "Foreign fix",
        Command: "tsgo.refactor.extract",
      },
    }},
    codeActionKinds: []string{"source.custom.ttsc"},
    commands:        []string{"ttsc.custom.fix"},
  }, driver.ProxyOptions{
    ExecuteCommandIDPrefix: prefix,
  })

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.custom.ttsc"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  actions := h.recvEditor()
  var decodedActions struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if !jsonContainsString(actions, "tsgo.refactor.extract") || jsonContainsString(actions, prefix+"tsgo.refactor.extract") {
    t.Fatalf("code action string values changed unexpectedly: %s", actions)
  }
  if err := json.Unmarshal(actions, &decodedActions); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, actions)
  }
  if len(decodedActions.Result) != 1 || decodedActions.Result[0].Command == nil ||
    decodedActions.Result[0].Command.Command != "tsgo.refactor.extract" {
    t.Fatalf("code action command differs from the independently expected ID: %s", actions)
  }
}
