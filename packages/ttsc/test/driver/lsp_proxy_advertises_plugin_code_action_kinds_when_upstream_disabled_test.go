package driver_test

import (
  "encoding/json"
  "testing"
)

// TestLSPProxyAdvertisesPluginCodeActionKindsWhenUpstreamDisabled verifies plugin
// code-action kind metadata survives an upstream `false` provider.
//
// Some clients use `codeActionProvider.codeActionKinds` to decide whether to
// send source-action requests. If upstream disables code actions, ttsc still
// needs to advertise plugin kinds as an option object rather than collapsing the
// capability to bare `true`.
//
// 1. Configure a source that advertises `source.fixAll.ttsc`.
// 2. Return upstream initialize capabilities with `codeActionProvider: false`.
// 3. Assert the editor sees a provider object with the plugin kind.
func TestLSPProxyAdvertisesPluginCodeActionKindsWhenUpstreamDisabled(t *testing.T) {
  h := newProxyHarness(t, &stubSource{
    codeActionKinds: []string{"source.fixAll.ttsc"},
  })
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}`))
  _ = h.recvUpstream()
  h.sendUpstream([]byte(`{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"codeActionProvider":false}}}`))

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
  if len(got) != 1 || got[0] != "source.fixAll.ttsc" {
    t.Fatalf("plugin codeActionKinds were not advertised: %#v", got)
  }
}
