package driver_test

import (
  "encoding/json"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyExecutesOwnedCommandWithNullEdit covers the "command ran
// but had nothing to apply" path: the proxy responds with result=null
// instead of a WorkspaceEdit, so the editor knows the command was
// handled even though no edit is required.
//
// 1. Configure a source that owns the command and returns (nil, nil).
// 2. Send an executeCommand request.
// 3. Assert the editor sees a null result tied to the request id.
// 4. Assert upstream sees no frame.
func TestLSPProxyExecutesOwnedCommandWithNullEdit(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.noop"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      return nil, nil
    },
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":9,"method":"workspace/executeCommand","params":{"command":"ttsc.noop"}}`)
  h.sendEditor(request)
  body := h.recvEditor()

  if !strings.Contains(string(body), `"result":null`) {
    t.Fatalf("expected null result:\n%s", body)
  }
  if !strings.Contains(string(body), `"id":9`) {
    t.Fatalf("response did not echo request id:\n%s", body)
  }
  h.expectNoUpstreamFrame(150 * time.Millisecond)
}
