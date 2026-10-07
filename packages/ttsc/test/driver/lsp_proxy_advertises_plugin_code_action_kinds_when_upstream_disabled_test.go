package driver_test

import (
  "encoding/json"
  "testing"
)

// TestLSPProxyAdvertisesPluginCodeActionKindsWhenUpstreamDisabled Verifies plugin
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
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run rewrites initialize capabilities from codeActionProvider false to an object containing source.fixAll.ttsc.
// @evidence contracts/testing.md#independent-expectations The stub advertises the literal plugin kind, and an upstream false provider cannot erase that plugin capability.
// @evidence contracts/testing.md#distinguishing-cases The disabled-upstream plus populated-plugin-kind combination is owned here; other initialize provider shapes have their own cases.
// @evidence contracts/testing.md#execution-ownership The Go test/driver proxy harness drives io.Pipe frames with a stub PluginSource and joins the in-process proxy on cleanup.
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
