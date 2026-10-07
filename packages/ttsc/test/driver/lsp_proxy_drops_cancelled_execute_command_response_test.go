package driver_test

import (
  "encoding/json"
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyDropsCancelledExecuteCommandResponse Verifies that no command response is written after cancellation wins over a blocked callback.
//
// Start, forwarded cancel, and release enforce cancellation-before-completion; silence is observed for 150 milliseconds.
//
// 1. Start an owned executeCommand request and block the plugin callback.
// 2. Send `$/cancelRequest` for that request id.
// 3. Release the plugin callback with a WorkspaceEdit.
// 4. Assert no editor response is written.
//
// @evidence contracts/testing.md#behavioral-verification No command response is written after cancellation wins over a blocked callback.
// @evidence contracts/testing.md#independent-expectations Cancellation retires the request identity despite the callback's later fixed WorkspaceEdit.
// @evidence contracts/testing.md#distinguishing-cases Start, forwarded cancel, and release enforce cancellation-before-completion; silence is observed for 150 milliseconds.
// @evidence contracts/testing.md#execution-ownership The command is an in-process Go callback ordered by channels in the private proxy session. Go discovers TestLSPProxyDropsCancelledExecuteCommandResponse under ./test/driver.
func TestLSPProxyDropsCancelledExecuteCommandResponse(t *testing.T) {
  started := make(chan struct{})
  release := make(chan struct{})
  var releaseCallbackOnce sync.Once
  releaseCallback := func() { releaseCallbackOnce.Do(func() { close(release) }) }
  t.Cleanup(releaseCallback)
  defer releaseCallback()
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
  releaseCallback()
  h.expectNoEditorFrame(150 * time.Millisecond)
}
