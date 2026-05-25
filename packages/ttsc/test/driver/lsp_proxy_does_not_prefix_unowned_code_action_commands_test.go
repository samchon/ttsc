package driver_test

import (
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDoesNotPrefixUnownedCodeActionCommands verifies command
// namespacing stays limited to commands advertised by PluginSource.CommandIDs.
//
// NativePluginSource drops unowned code-action commands before they reach the
// proxy, but third-party embedders can implement PluginSource directly. If the
// proxy prefixes a foreign command, the editor later invokes a command id that
// no provider owns, so the command must remain untouched.
//
// 1. Configure a source that advertises one custom command.
// 2. Return a code action whose command id is not advertised by the source.
// 3. Request the plugin-only action kind.
// 4. Assert the unowned command is not prefixed in the editor response.
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
  if !jsonContainsString(actions, "tsgo.refactor.extract") ||
    jsonContainsString(actions, prefix+"tsgo.refactor.extract") {
    t.Fatalf("unowned code-action command was prefixed:\n%s", actions)
  }
}
