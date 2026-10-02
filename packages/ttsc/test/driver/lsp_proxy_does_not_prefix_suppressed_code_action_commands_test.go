package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDoesNotPrefixSuppressedCodeActionCommands Verifies wrapper-owned
// commands stay addressable by the VS Code extension's contributed commands.
//
// VS Code registers built-in lint and format wrappers itself, so the proxy
// suppresses those ids from executeCommandProvider. If code actions were still
// namespaced, clicking a built-in action would invoke an unregistered prefixed
// command instead of the extension wrapper.
//
// 1. Configure a source that owns `ttsc.lint.fixAll`.
// 2. Suppress that command while enabling an execute-command prefix.
// 3. Request the plugin-only fix-all action kind.
// 4. Assert the returned code-action command remains unprefixed.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run handles the fix-all request locally and the sole decoded action.command.command equals the literal ttsc.lint.fixAll, excluding a prefixed or unrelated ID.
// @evidence contracts/testing.md#independent-expectations A suppressed extension-owned wrapper remains addressable by its contributed command id; the literal original and prefixed ids form independent controls.
// @evidence contracts/testing.md#distinguishing-cases Suppression combined with a nonempty namespace prefix owns this exception; unowned command rewriting has a separate case.
// @evidence contracts/testing.md#execution-ownership Go test/driver uses ProxyOptions and the pipe harness with stub actions; the 150ms upstream check observes local dispatch without a VS Code process.
func TestLSPProxyDoesNotPrefixSuppressedCodeActionCommands(t *testing.T) {
  const prefix = "ttsc.vscode.root."
  h := newProxyHarnessWithOptions(t, &stubSource{
    actions: []driver.LSPCodeAction{{
      Title: "Fix all lint issues",
      Kind:  "source.fixAll.ttsc",
      Command: &driver.LSPCommand{
        Title:   "Fix all lint issues",
        Command: "ttsc.lint.fixAll",
      },
    }},
    commands: []string{"ttsc.lint.fixAll"},
  }, driver.ProxyOptions{
    SuppressedExecuteCommandIDs: []string{"ttsc.lint.fixAll"},
    ExecuteCommandIDPrefix:      prefix,
  })

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.fixAll.ttsc"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  actions := h.recvEditor()
  var decodedActions struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if !jsonContainsString(actions, "ttsc.lint.fixAll") || jsonContainsString(actions, prefix+"ttsc.lint.fixAll") {
    t.Fatalf("code action string values changed unexpectedly: %s", actions)
  }
  if err := json.Unmarshal(actions, &decodedActions); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, actions)
  }
  if len(decodedActions.Result) != 1 || decodedActions.Result[0].Command == nil ||
    decodedActions.Result[0].Command.Command != "ttsc.lint.fixAll" {
    t.Fatalf("code action command differs from the independently expected ID: %s", actions)
  }
}
