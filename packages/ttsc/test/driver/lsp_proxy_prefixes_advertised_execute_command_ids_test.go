package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyPrefixesAdvertisedExecuteCommandIDs Verifies that a custom command is prefixed in initialize and its action, then restored before ExecuteCommand.
//
// Custom routing and built-in suppression coexist; unowned prefix behavior has separate coverage.
//
// 1. Configure a suppressed built-in command and one prefixed custom command.
// 2. Assert initialize advertises only the literal prefixed custom ID.
// 3. Request a custom action and inspect its prefixed command.
// 4. Execute that command and assert the callback sees its original ID.
//
// @evidence contracts/testing.md#behavioral-verification A custom command is prefixed in initialize and its action, then restored before ExecuteCommand.
// @evidence contracts/testing.md#independent-expectations The upstream fixture advertises no commands; the literal one-element prefixed custom commands array and action.command.command, plus the captured original callback ID, independently define the namespace round trip.
// @evidence contracts/testing.md#distinguishing-cases Custom routing and built-in suppression coexist; unowned prefix behavior has separate coverage.
// @evidence contracts/testing.md#execution-ownership Initialize, action, and command requests share one configured Go pipe proxy. Go discovers TestLSPProxyPrefixesAdvertisedExecuteCommandIDs under ./test/driver.
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
  var initialization struct {
    Result struct {
      Capabilities struct {
        ExecuteCommandProvider struct {
          Commands []string `json:"commands"`
        } `json:"executeCommandProvider"`
      } `json:"capabilities"`
    } `json:"result"`
  }
  if !jsonContainsString(initialized, prefix+"ttsc.custom.fix") || jsonContainsString(initialized, "ttsc.lint.fixAll") {
    t.Fatalf("initialize command ids not namespaced/suppressed:\n%s", initialized)
  }
  if err := json.Unmarshal(initialized, &initialization); err != nil {
    t.Fatalf("initialize response not JSON: %v\n%s", err, initialized)
  }
  commands := initialization.Result.Capabilities.ExecuteCommandProvider.Commands
  if len(commands) != 1 || commands[0] != prefix+"ttsc.custom.fix" {
    t.Fatalf("initialize command IDs = %#v, want only %q", commands, prefix+"ttsc.custom.fix")
  }

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/codeAction","params":{"textDocument":{"uri":"file:///a.ts"},"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"context":{"diagnostics":[],"only":["source.custom.ttsc"]}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  actions := h.recvEditor()
  var decodedActions struct {
    Result []driver.LSPCodeAction `json:"result"`
  }
  if !jsonContainsString(actions, prefix+"ttsc.custom.fix") {
    t.Fatalf("code action omitted the prefixed command ID: %s", actions)
  }
  if err := json.Unmarshal(actions, &decodedActions); err != nil {
    t.Fatalf("code action response not JSON: %v\n%s", err, actions)
  }
  if len(decodedActions.Result) != 1 || decodedActions.Result[0].Command == nil ||
    decodedActions.Result[0].Command.Command != prefix+"ttsc.custom.fix" {
    t.Fatalf("code action command differs from the independently expected ID: %s", actions)
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
