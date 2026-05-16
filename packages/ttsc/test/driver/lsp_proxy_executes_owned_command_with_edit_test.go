package driver_test

import (
  "encoding/json"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyExecutesOwnedCommandWithEdit verifies the local dispatch
// path for ttsc-owned executeCommand requests when the source returns a
// WorkspaceEdit. The proxy must respond directly to the editor with the
// edit in the result field and never forward the request to tsgo
// upstream — that is the whole reason VSCode plugin commands work
// without an upstream code action provider.
//
// 1. Configure a source that owns "ttsc.lint.fix" and returns a WorkspaceEdit.
// 2. Send an executeCommand request for that command.
// 3. Assert the editor sees the WorkspaceEdit in result.
// 4. Assert upstream sees no frame within a short window.
func TestLSPProxyExecutesOwnedCommandWithEdit(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.lint.fix"},
    execute: func(command string, _ []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      if command != "ttsc.lint.fix" {
        t.Fatalf("unexpected command: %q", command)
      }
      return &driver.LSPWorkspaceEdit{
        Changes: map[string][]driver.LSPTextEdit{
          "file:///a.ts": {{
            Range:   driver.LSPRange{Start: driver.LSPPosition{Line: 0, Character: 0}, End: driver.LSPPosition{Line: 0, Character: 1}},
            NewText: "X",
          }},
        },
      }, nil
    },
  }
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":5,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fix","arguments":[]}}`)
  h.sendEditor(request)
  body := h.recvEditor()

  if !strings.Contains(string(body), `"changes"`) {
    t.Fatalf("response missing WorkspaceEdit changes:\n%s", body)
  }
  if !strings.Contains(string(body), `"newText":"X"`) {
    t.Fatalf("response did not carry the edit:\n%s", body)
  }
  if !strings.Contains(string(body), `"id":5`) {
    t.Fatalf("response did not echo request id:\n%s", body)
  }

  h.expectNoUpstreamFrame(150 * time.Millisecond)
}
