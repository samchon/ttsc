package driver_test

import (
  "encoding/json"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsCancelledExecuteCommandResponse verifies owned command
// execution honors request cancellation.
//
// Owned commands run asynchronously so the editor pump keeps forwarding later
// traffic. If the editor cancels the request while the sidecar is blocked, the
// proxy must drop the late WorkspaceEdit response instead of writing to an id
// the editor has already abandoned.
//
// 1. Start an owned executeCommand request and block the plugin callback.
// 2. Send `$/cancelRequest` for that request id.
// 3. Release the plugin callback with a WorkspaceEdit.
// 4. Assert no editor response is written.
func TestLSPProxyDropsCancelledExecuteCommandResponse(t *testing.T) {
  started := make(chan struct{})
  release := make(chan struct{})
  var called atomic.Bool
  source := &stubSource{
    commands: []string{"ttsc.lint.fixAll"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      if called.CompareAndSwap(false, true) {
        close(started)
      }
      <-release
      return &driver.LSPWorkspaceEdit{
        Changes: map[string][]driver.LSPTextEdit{
          "file:///a.ts": {{
            Range: driver.LSPRange{
              Start: driver.LSPPosition{Line: 0, Character: 0},
              End:   driver.LSPPosition{Line: 0, Character: 1},
            },
            NewText: "b",
          }},
        },
      }, nil
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":30,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fixAll","arguments":["file:///a.ts"]}}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("executeCommand did not start")
  }
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"$/cancelRequest","params":{"id":30}}`))
  _ = h.recvUpstream()
  close(release)
  h.expectNoEditorFrame(150 * time.Millisecond)
}
