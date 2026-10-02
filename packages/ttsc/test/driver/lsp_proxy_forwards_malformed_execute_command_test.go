package driver_test

import (
  "bytes"
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsMalformedExecuteCommand Verifies the params-decode
// failure path in tryExecuteCommand. The proxy must forward verbatim
// rather than respond locally, because we cannot tell whether tsgo's
// schema would accept the malformed params.
//
// 1. Configure a source that would own the command but should never be invoked.
// 2. Send an executeCommand request with params=42 (decode fails).
// 3. Assert the request still reaches upstream verbatim.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards the executeCommand request unchanged when numeric params cannot decode as command parameters, without invoking the callback.
// @evidence contracts/testing.md#independent-expectations Uninterpretable command params remain upstream responsibility; the authored request bytes detect local absorption or normalization.
// @evidence contracts/testing.md#distinguishing-cases A would-be owned command source paired with params 42 exercises decode failure; valid owned requests are handled in separate cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver drives the actual proxy using in-memory pipes and a stub that reports an error if called, not a native host.
func TestLSPProxyForwardsMalformedExecuteCommand(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.lint.fix"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      t.Error("execute should not run when params decode fails")
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
