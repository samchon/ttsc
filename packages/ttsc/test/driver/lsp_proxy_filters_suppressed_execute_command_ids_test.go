package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyFiltersSuppressedExecuteCommandIDs verifies wrapper-owned command
// ids can be hidden without hiding custom plugin command ids.
//
// The VS Code extension registers built-in lint/format wrappers itself, but
// third-party command-backed code actions still need their command ids
// advertised so vscode-languageclient can register and forward them.
//
// 1. Start a proxy with two suppressed built-in command ids.
// 2. Configure a source with a built-in command and a custom command.
// 3. Forward initialize through an upstream response.
// 4. Assert only the custom command remains in executeCommandProvider.
func TestLSPProxyFiltersSuppressedExecuteCommandIDs(t *testing.T) {
  h := newProxyHarnessWithOptions(
    t,
    &stubSource{
      commands: []string{
        "ttsc.lint.fixAll",
        "ttsc.format.document",
        "ttsc.custom.fix",
      },
    },
    driver.ProxyOptions{
      SuppressedExecuteCommandIDs: []string{
        "ttsc.lint.fixAll",
        "ttsc.format.document",
      },
    },
  )

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{}}}`))

  body := h.recvEditor()
  var decoded struct {
    Result struct {
      Capabilities struct {
        ExecuteCommandProvider struct {
          Commands []string `json:"commands"`
        } `json:"executeCommandProvider"`
      } `json:"capabilities"`
    } `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("initialize response not JSON: %v\n%s", err, body)
  }
  commands := decoded.Result.Capabilities.ExecuteCommandProvider.Commands
  if len(commands) != 1 || commands[0] != "ttsc.custom.fix" {
    t.Fatalf("executeCommandProvider commands mismatch: %#v\n%s", commands, body)
  }
}
