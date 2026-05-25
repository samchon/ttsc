package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyPrefixesAdvertisedExecuteCommandIDs verifies multi-client hosts
// can namespace custom plugin commands.
//
// VS Code registers every `executeCommandProvider.commands` id globally, so two
// project roots advertising the same custom plugin command would collide. The
// proxy prefixes only advertised ids, rewrites matching code-action commands,
// and maps the prefixed id back before calling the plugin source.
//
// 1. Configure one suppressed wrapper command and one custom command.
// 2. Assert initialize advertises only the prefixed custom command.
// 3. Request a custom code action and assert its command id is prefixed.
// 4. Execute the prefixed command and assert the source sees the original id.
func TestLSPProxyPrefixesAdvertisedExecuteCommandIDs(t *testing.T) {
  const prefix = "ttsc.vscode.root."
  called := make(chan string, 1)
  h := newProxyHarnessWithOptions(t, &stubSource{
    actions: []driver.LSPCodeAction{{
      Title: "Custom fix",
      Kind:  "source.custom.ttsc",
      Command: &driver.LSPCommand{
        Title:   "Custom fix",
        Command: "ttsc.custom.fix",
      },
    }},
    codeActionKinds: []string{"source.custom.ttsc"},
    commands:        []string{"ttsc.lint.fixAll", "ttsc.custom.fix"},
    execute: func(command string, _ []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      called <- command
      return nil, nil
    },
  }, driver.ProxyOptions{
    SuppressedExecuteCommandIDs: []string{"ttsc.lint.fixAll"},
    ExecuteCommandIDPrefix:      prefix,
  })

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":true}}}`))
  initialized := h.recvEditor()
  if !jsonContainsString(initialized, prefix+"ttsc.custom.fix") || jsonContainsString(initialized, "ttsc.lint.fixAll") {
    t.Fatalf("initialize command ids not namespaced/suppressed:\n%s", initialized)
  }

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.custom.ttsc"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  actions := h.recvEditor()
  if !jsonContainsString(actions, prefix+"ttsc.custom.fix") || jsonContainsString(actions, `"command":"ttsc.custom.fix"`) {
    t.Fatalf("code action command id was not namespaced:\n%s", actions)
  }

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":3,"method":"workspace/executeCommand","params":{"command":"` + prefix + `ttsc.custom.fix","arguments":[]}}`))
  _ = h.recvEditor()
  select {
  case got := <-called:
    if got != "ttsc.custom.fix" {
      t.Fatalf("ExecuteCommand saw %q", got)
    }
  case <-time.After(2 * time.Second):
    t.Fatal("ExecuteCommand was not called")
  }
}

func jsonContainsString(body []byte, value string) bool {
  var walk func(any) bool
  walk = func(node any) bool {
    switch typed := node.(type) {
    case string:
      return typed == value
    case []any:
      for _, item := range typed {
        if walk(item) {
          return true
        }
      }
    case map[string]any:
      for _, item := range typed {
        if walk(item) {
          return true
        }
      }
    }
    return false
  }
  var decoded any
  return json.Unmarshal(body, &decoded) == nil && walk(decoded)
}
