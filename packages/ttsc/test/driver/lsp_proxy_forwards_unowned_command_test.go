package driver_test

import (
  "bytes"
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsUnownedCommand Verifies that an unowned executeCommand forwards unchanged without invoking the source.
//
// The callback fails if called, exposing accidental interception.
//
// 1. Configure a source that owns one command id but not another.
// 2. Send a request for the unowned command.
// 3. Assert the request reaches upstream verbatim.
//
// @evidence contracts/testing.md#behavioral-verification An unowned executeCommand forwards unchanged without invoking the source.
// @evidence contracts/testing.md#independent-expectations A different advertised command leaves the authored request under upstream ownership.
// @evidence contracts/testing.md#distinguishing-cases The callback fails if called, exposing accidental interception.
// @evidence contracts/testing.md#execution-ownership The Go pipe proxy dispatches a literal request with no external command process. Go discovers TestLSPProxyForwardsUnownedCommand under ./test/driver.
func TestLSPProxyForwardsUnownedCommand(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.lint.fix"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      t.Error("execute should not be called for unowned command")
      return nil, nil
    },
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":1,"method":"workspace/executeCommand","params":{"command":"tsgo.refactor.extract"}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); !bytes.Equal(got, request) {
    t.Fatalf("upstream mismatch:\n%s", got)
  }
}
