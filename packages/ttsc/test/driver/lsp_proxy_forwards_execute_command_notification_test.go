package driver_test

import (
  "bytes"
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyForwardsExecuteCommandNotification Verifies that the
// "is a request" guard in tryExecuteCommand actually narrows the local
// dispatch path: a notification-shaped executeCommand (no id) must reach
// upstream verbatim instead of being silently absorbed.
//
// 1. Configure a source that owns the command and would respond.
// 2. Send the same command as a notification.
// 3. Assert it arrives upstream byte-equal.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards an owned executeCommand notification byte-for-byte and does not invoke its error-reporting stub command callback.
// @evidence contracts/testing.md#independent-expectations JSON-RPC notifications carry no request id and must not be answered through local request dispatch.
// @evidence contracts/testing.md#distinguishing-cases The same owned command is sent without id, contrasting with the owned-command request success case.
// @evidence contracts/testing.md#execution-ownership The Go test/driver pipe harness executes the proxy request-shape guard with a stub source, without a command producer.
func TestLSPProxyForwardsExecuteCommandNotification(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.lint.fix"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      t.Error("execute should not run for notification")
      return nil, nil
    },
  }
  h := newProxyHarness(t, source)

  notification := []byte(`{"jsonrpc":"2.0","method":"workspace/executeCommand","params":{"command":"ttsc.lint.fix"}}`)
  h.sendEditor(notification)
  if got := h.recvUpstream(); !bytes.Equal(got, notification) {
    t.Fatalf("upstream mismatch:\n%s", got)
  }
}
