package driver_test

import (
  "bytes"
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsMalformedExecuteCommand covers the params-decode
// failure path in tryExecuteCommand. The proxy must forward verbatim
// rather than respond locally, because we cannot tell whether tsgo's
// schema would accept the malformed params.
//
// 1. Configure a source that would own the command but should never be invoked.
// 2. Send an executeCommand request with params=42 (decode fails).
// 3. Assert the request still reaches upstream verbatim.
func TestLSPProxyForwardsMalformedExecuteCommand(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.lint.fix"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      t.Fatal("execute should not run when params decode fails")
      return nil, nil
    },
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":4,"method":"workspace/executeCommand","params":42}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("upstream mismatch:\n%s", got)
  }
}
