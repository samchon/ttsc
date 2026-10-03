package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesExecuteCommandProvider Verifies that initialize enables code actions while omitting executeCommandProvider when suppression is requested.
//
// Upstream false codeActionProvider becomes true, and the command-provider field stays absent.
//
// 1. Start a proxy with SuppressExecuteCommandProvider enabled.
// 2. Forward initialize and return an upstream response without code actions.
// 3. Assert codeActionProvider is enabled and executeCommandProvider is absent.
//
// @evidence contracts/testing.md#behavioral-verification Initialize enables code actions while omitting executeCommandProvider when suppression is requested.
// @evidence contracts/testing.md#independent-expectations Explicit provider suppression must hide command registration while retaining actions.
// @evidence contracts/testing.md#distinguishing-cases Upstream false codeActionProvider becomes true, and the command-provider field stays absent.
// @evidence contracts/testing.md#execution-ownership The synthetic initialize exchange executes actual Go capability augmentation. Go discovers TestLSPProxySuppressesExecuteCommandProvider under ./test/driver.
func TestLSPProxySuppressesExecuteCommandProvider(t *testing.T) {
  h := newProxyHarnessWithOptions(
    t,
    &stubSource{commands: []string{"ttsc.lint.fixAll"}},
    driver.ProxyOptions{SuppressExecuteCommandProvider: true},
  )

  request := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`)
  h.sendEditor(request)
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":false}}}`))

  body := h.recvEditor()
  var decoded struct {
    Result struct {
      Capabilities map[string]json.RawMessage `json:"capabilities"`
    } `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("initialize response not JSON: %v\n%s", err, body)
  }
  if string(decoded.Result.Capabilities["codeActionProvider"]) != "true" {
    t.Fatalf("codeActionProvider was not enabled:\n%s", body)
  }
  if _, ok := decoded.Result.Capabilities["executeCommandProvider"]; ok {
    t.Fatalf("executeCommandProvider should be suppressed:\n%s", body)
  }
}
