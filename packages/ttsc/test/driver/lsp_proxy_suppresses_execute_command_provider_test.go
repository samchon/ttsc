package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesExecuteCommandProvider verifies client-owned command
// registration can opt out of server-advertised ttsc command ids.
//
// The VS Code extension contributes wrapper commands itself so command palette
// routing stays stable even when the server also supports executeCommand. The
// proxy must still advertise code actions, but skip executeCommandProvider when
// the extension asks for command suppression.
//
// 1. Start a proxy with SuppressExecuteCommandProvider enabled.
// 2. Forward initialize and return an upstream response without code actions.
// 3. Assert codeActionProvider is enabled and executeCommandProvider is absent.
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
