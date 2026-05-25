package driver_test

import (
  "encoding/json"
  "testing"
)

// TestLSPProxyMergesPluginCodeActionKinds verifies initialize capability
// augmentation preserves upstream kind restrictions while adding plugin kinds.
//
// Some LSP clients use `codeActionProvider.codeActionKinds` to decide which
// source-action requests are worth sending. If upstream advertises only
// TypeScript kinds, the proxy must add ttsc plugin kinds or the editor can hide
// fix-all and format commands even though the sidecar can serve them.
//
// 1. Configure a source that advertises `source.fixAll.ttsc`.
// 2. Return upstream initialize capabilities with a restricted kind list.
// 3. Assert both upstream and plugin code action kinds are present.
func TestLSPProxyMergesPluginCodeActionKinds(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    commands:        []string{"ttsc.lint.fixAll"},
    codeActionKinds: []string{"source.fixAll.ttsc"},
  })
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":{"codeActionKinds":["quickfix"]}}}}`))

  body := h.recvEditor()
  var decoded struct {
    Result struct {
      Capabilities struct {
        CodeActionProvider struct {
          CodeActionKinds []string `json:"codeActionKinds"`
        } `json:"codeActionProvider"`
      } `json:"capabilities"`
    } `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("initialize response not JSON: %v\n%s", err, body)
  }
  got := decoded.Result.Capabilities.CodeActionProvider.CodeActionKinds
  if !containsString(got, "quickfix") || !containsString(got, "source.fixAll.ttsc") {
    t.Fatalf("codeActionKinds were not merged: %#v", got)
  }
}

func containsString(values []string, want string) bool {
  for _, value := range values {
    if value == want {
      return true
    }
  }
  return false
}
