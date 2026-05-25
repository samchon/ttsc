package driver_test

import (
  "encoding/json"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyExecuteCommandDropsEditAfterDirtySave verifies command edits stay
// tied to the document generation active when the command started.
//
// Command arguments may be opaque and omit document URIs. If the editor changes
// and saves an edit target while a disk-backed sidecar command is still running,
// the document is clean again, but the sidecar computed against an old snapshot.
//
// 1. Start an owned executeCommand request with no URI arguments.
// 2. Send didChange and didSave for the edit target while the callback blocks.
// 3. Release the callback with a WorkspaceEdit for that target.
// 4. Assert the proxy returns null instead of the stale edit.
func TestLSPProxyExecuteCommandDropsEditAfterDirtySave(t *testing.T) {
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

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":24,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fixAll","arguments":[]}}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("executeCommand did not start")
  }
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"dirty"}]}}`))
  _ = h.recvUpstream()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":"file:///a.ts","version":2}}}`))
  _ = h.recvUpstream()
  close(release)

  body := h.recvEditor()
  var decoded struct {
    Result any `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("executeCommand response not JSON: %v\n%s", err, body)
  }
  if decoded.Result != nil {
    t.Fatalf("dirty-saved command response was not suppressed:\n%s", body)
  }
}
