package driver_test

import (
  "encoding/json"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyReportsNotHandledOwnedCommandError verifies advertised commands
// stay local even when the source fails to route them.
//
// The proxy must keep editor traffic flowing while a sidecar command runs, so
// it cannot wait for a late ErrCommandNotHandled result and then replay the
// original request upstream in its original stream position. Advertising the
// command id means ttsc owns it; a missed route is surfaced as a command error.
//
// 1. Configure a source that advertises a command.
// 2. Return ErrCommandNotHandled from ExecuteCommand.
// 3. Assert the editor sees an error response.
// 4. Assert upstream sees no fallback frame.
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
