package driver_test

import (
  "encoding/json"
  "errors"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyReportsOwnedCommandError Verifies the error response shape
// when a ttsc-owned command fails. The proxy must surface a JSON-RPC
// error so the editor reports the failure to the user instead of
// silently swallowing it.
//
// The independent failure sentinel and JSON-RPC internal-error code determine the result.
//
// 1. Configure a source whose execute callback returns a non-handled error.
// 2. Send an executeCommand request.
// 3. Assert the editor sees an error response with code -32603.
// 4. Assert upstream sees no frame.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns local error -32603 and the injected message with no upstream frame during 150ms.
// @evidence contracts/testing.md#independent-expectations The independent failure sentinel and JSON-RPC internal-error code determine the result.
// @evidence contracts/testing.md#distinguishing-cases Ordinary owned failure contrasts with stale-error suppression; permanent silence is not proved.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyReportsOwnedCommandError in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyReportsOwnedCommandError(t *testing.T) {
  failure := errors.New("ttsc fix failed")
  source := &stubSource{
    commands: []string{"ttsc.lint.fix"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      return nil, failure
    },
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":42,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fix"}}`)
  h.sendEditor(request)
  body := h.recvEditor()

  if !strings.Contains(string(body), `"error"`) {
    t.Fatalf("expected error response:\n%s", body)
  }
  if !strings.Contains(string(body), `-32603`) {
    t.Fatalf("expected internal-error code:\n%s", body)
  }
  if !strings.Contains(string(body), `ttsc fix failed`) {
    t.Fatalf("error message lost:\n%s", body)
  }
  h.expectNoUpstreamFrame(150 * time.Millisecond)
}
