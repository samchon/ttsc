package driver_test

import (
  "encoding/json"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyReportsNotHandledOwnedCommandError Verifies that an advertised command returning ErrCommandNotHandled produces a local error with advertised but not handled and no fallback.
//
// Owned failed routing contrasts with unowned forwarding and owned no-op success.
//
// 1. Configure a source that advertises a command.
// 2. Return ErrCommandNotHandled from ExecuteCommand.
// 3. Assert the editor sees an error response.
// 4. Assert upstream sees no fallback frame.
//
// @evidence contracts/testing.md#behavioral-verification An advertised command returning ErrCommandNotHandled produces a local error with advertised but not handled and no fallback.
// @evidence contracts/testing.md#independent-expectations Advertising a command commits local ownership; the authored stub failure must not replay upstream.
// @evidence contracts/testing.md#distinguishing-cases Owned failed routing contrasts with unowned forwarding and owned no-op success.
// @evidence contracts/testing.md#execution-ownership The Go callback and pipe proxy execute locally, with upstream silence observed for 150 milliseconds. Go discovers TestLSPProxyReportsNotHandledOwnedCommandError under ./test/driver.
func TestLSPProxyReportsNotHandledOwnedCommandError(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.lint.fix"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      return nil, driver.ErrCommandNotHandled
    },
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":2,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fix"}}`)
  h.sendEditor(request)
  body := h.recvEditor()

  if !strings.Contains(string(body), `"error"`) {
    t.Fatalf("expected error response:\n%s", body)
  }
  if !strings.Contains(string(body), `advertised but not handled`) {
    t.Fatalf("not-handled detail missing:\n%s", body)
  }
  h.expectNoUpstreamFrame(150 * time.Millisecond)
}
