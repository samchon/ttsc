package driver_test

import (
  "bytes"
  "encoding/json"
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyExecuteCommandDropsEditAfterDirtySave Verifies that a URI-less command yields null after its edit target changes and saves during the blocked callback.
//
// The callback spans didChange and didSave before returning the fixed target edit.
//
// 1. Start an owned executeCommand request with no URI arguments.
// 2. Send didChange and didSave for the edit target while the callback blocks.
// 3. Release the callback with a WorkspaceEdit for that target.
// 4. Assert the proxy returns null instead of the stale edit.
//
// @evidence contracts/testing.md#behavioral-verification A URI-less command yields null after its edit target changes and saves during the blocked callback.
// @evidence contracts/testing.md#independent-expectations Saving does not restore the generation used to compute the authored edit.
// @evidence contracts/testing.md#distinguishing-cases The callback spans didChange and didSave before returning the fixed target edit.
// @evidence contracts/testing.md#execution-ownership The Go pipe proxy and channel-controlled command callback run in process. Go discovers TestLSPProxyExecuteCommandDropsEditAfterDirtySave under ./test/driver.
func TestLSPProxyExecuteCommandDropsEditAfterDirtySave(t *testing.T) {
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
  releaseCallback()

  body := h.recvEditor()
  var decoded struct {
    ID int `json:"id"`
    Result any `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("executeCommand response not JSON: %v\n%s", err, body)
  }
  if decoded.Result != nil {
    t.Fatalf("dirty-saved command response was not suppressed:\n%s", body)
  }
  var members map[string]json.RawMessage
  if err := json.Unmarshal(body, &members); err != nil {
    t.Fatalf("command response members are not JSON: %v", err)
  }
  if decoded.ID != 24 || !bytes.Equal(bytes.TrimSpace(members["result"]), []byte("null")) {
    t.Fatalf("dirty-saved command must receive its correlated explicit null: %s", body)
  }
}
