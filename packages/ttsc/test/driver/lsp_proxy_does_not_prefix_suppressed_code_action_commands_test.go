package driver_test

import (
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDoesNotPrefixSuppressedCodeActionCommands verifies wrapper-owned
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
  if !jsonContainsString(actions, "ttsc.lint.fixAll") ||
    jsonContainsString(actions, prefix+"ttsc.lint.fixAll") {
    t.Fatalf("suppressed code-action command was prefixed:\n%s", actions)
  }
}
