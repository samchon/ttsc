package driver_test

import (
  "encoding/json"
  "testing"
)

// TestLSPProxyAugmentsInitializeCapabilities verifies plugin LSP capabilities
// are advertised even when upstream has no codeAction provider.
//
// Editors gate code-action requests on the initialize result. If tsgo returns
// `codeActionProvider: false`, ttsc still needs to expose plugin code actions
// and executeCommand handlers so the VS Code extension can request and route
// them.
//
// 1. Configure a source that owns `ttsc.lint.fixAll`.
// 2. Forward initialize to upstream.
// 3. Reply from upstream with `codeActionProvider: false`.
// 4. Assert the editor sees codeActionProvider true and the plugin command id.
func TestLSPProxyAugmentsInitializeCapabilities(t *testing.T) {
  h := newProxyHarness(t, &stubSource{commands: []string{"ttsc.lint.fixAll"}})

  request := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); string(got) != string(request) {
    t.Fatalf("upstream did not see initialize request:\n%s", got)
  }

  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":false}}}`))
  body := h.recvEditor()
  var decoded struct {
    Result struct {
      Capabilities struct {
        CodeActionProvider     bool `json:"codeActionProvider"`
        ExecuteCommandProvider struct {
          Commands []string `json:"commands"`
        } `json:"executeCommandProvider"`
      } `json:"capabilities"`
    } `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("initialize response not JSON: %v\n%s", err, body)
  }
  if !decoded.Result.Capabilities.CodeActionProvider {
    t.Fatalf("codeActionProvider was not enabled:\n%s", body)
  }
  commands := decoded.Result.Capabilities.ExecuteCommandProvider.Commands
  if len(commands) != 1 || commands[0] != "ttsc.lint.fixAll" {
    t.Fatalf("executeCommandProvider commands mismatch: %#v", commands)
  }
}
