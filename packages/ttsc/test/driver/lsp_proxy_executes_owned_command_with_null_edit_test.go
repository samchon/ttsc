package driver_test

import (
  "encoding/json"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyExecutesOwnedCommandWithNullEdit Verifies that an owned no-op command returns null with the request ID and no upstream frame.
//
// Owned no-op handling contrasts with unowned forwarding and owned failures in other entries.
//
// 1. Configure a source that owns the command and returns (nil, nil).
// 2. Send an executeCommand request.
// 3. Assert the editor sees a null result tied to the request id.
// 4. Assert upstream sees no frame.
//
// @evidence contracts/testing.md#behavioral-verification An owned no-op command returns null with the request ID and no upstream frame.
// @evidence contracts/testing.md#independent-expectations A handled command with no edit has a successful null JSON-RPC result.
// @evidence contracts/testing.md#distinguishing-cases Owned no-op handling contrasts with unowned forwarding and owned failures in other entries.
// @evidence contracts/testing.md#execution-ownership The Go proxy invokes its stub callback through private harness pipes. Go discovers TestLSPProxyExecutesOwnedCommandWithNullEdit under ./test/driver.
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
