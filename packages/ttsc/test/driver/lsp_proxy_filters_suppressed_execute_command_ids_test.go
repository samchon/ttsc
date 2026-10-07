package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyFiltersSuppressedExecuteCommandIDs Verifies that initialize removes two suppressed built-in command IDs and retains the custom advertised command.
//
// Built-in and custom commands coexist, distinguishing selective suppression from provider removal.
//
// 1. Start a proxy with two suppressed built-in command ids.
// 2. Configure a source with a built-in command and a custom command.
// 3. Forward initialize through an upstream response.
// 4. Assert only the custom command remains in executeCommandProvider.
//
// @evidence contracts/testing.md#behavioral-verification Initialize removes two suppressed built-in command IDs and retains the custom advertised command.
// @evidence contracts/testing.md#independent-expectations The explicit suppressed list and literal source IDs define the surviving command.
// @evidence contracts/testing.md#distinguishing-cases Built-in and custom commands coexist, distinguishing selective suppression from provider removal.
// @evidence contracts/testing.md#execution-ownership A synthetic initialize exchange drives capability augmentation in the Go proxy. Go discovers TestLSPProxyFiltersSuppressedExecuteCommandIDs under ./test/driver.
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
