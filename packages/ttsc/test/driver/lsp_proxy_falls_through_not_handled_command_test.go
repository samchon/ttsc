package driver_test

import (
  "bytes"
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyFallsThroughNotHandledCommand covers the late "I claimed
// this but actually I can't handle it" branch. PluginSource declares
// ownership in CommandIDs but its ExecuteCommand returns
// ErrCommandNotHandled — the proxy must then forward the request
// upstream rather than respond with an error.
//
// 1. Configure a source that lists the command yet returns ErrCommandNotHandled.
// 2. Send the request.
// 3. Assert it reaches upstream verbatim.
func TestLSPProxyFallsThroughNotHandledCommand(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.lint.fix"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      return nil, driver.ErrCommandNotHandled
    },
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":2,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fix"}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("upstream mismatch:\n%s", got)
  }
}
