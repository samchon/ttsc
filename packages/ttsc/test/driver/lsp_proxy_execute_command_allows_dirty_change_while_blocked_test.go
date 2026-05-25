package driver_test

import (
  "bytes"
  "encoding/json"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyExecuteCommandAllowsDirtyChangeWhileBlocked verifies command
// execution does not stop the editor pump.
//
// Native LSP sidecars can take seconds to compute a WorkspaceEdit. The proxy
// must forward didChange upstream while a command is blocked, then suppress the
// disk-backed edit when the document becomes dirty before the command returns.
//
// 1. Start an owned executeCommand request and block the plugin callback.
// 2. Send didChange for the same URI while the callback is blocked.
// 3. Assert the didChange reached upstream before releasing the callback.
// 4. Release the callback and assert the command response is null.
func TestLSPProxyExecuteCommandAllowsDirtyChangeWhileBlocked(t *testing.T) {
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

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":20,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fixAll","arguments":["file:///a.ts"]}}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("executeCommand did not start")
  }

  change := []byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"dirty"}]}}`)
  h.sendEditor(change)
  if got := h.recvUpstream(); !bytes.Equal(got, change) {
    t.Fatalf("didChange did not reach upstream before command completed:\n%s", got)
  }
  close(release)

  body := h.recvEditor()
  var decoded struct {
    Result any `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("executeCommand response not JSON: %v\n%s", err, body)
  }
  if decoded.Result != nil {
    t.Fatalf("dirty command response was not suppressed:\n%s", body)
  }
}
