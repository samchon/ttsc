package driver_test

import (
  "encoding/json"
  "errors"
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesURILessStaleExecuteCommandError Verifies that a URI-less command failure becomes null after the open document changes and saves.
//
// The callback starts after open and remains blocked across dirty/save transitions.
//
// 1. Start an owned executeCommand request with no URI arguments.
// 2. Send didChange and didSave while the plugin callback is blocked.
// 3. Release the callback with a plugin error.
// 4. Assert the response is JSON null rather than a JSON-RPC error.
//
// @evidence contracts/testing.md#behavioral-verification A URI-less command failure becomes null after the open document changes and saves.
// @evidence contracts/testing.md#independent-expectations The authored callback error belongs to an earlier generation and must not report a current workspace failure.
// @evidence contracts/testing.md#distinguishing-cases The callback starts after open and remains blocked across dirty/save transitions.
// @evidence contracts/testing.md#execution-ownership The Go pipe harness orders callbacks and notifications with channels and inspects error and result fields. Go discovers TestLSPProxySuppressesURILessStaleExecuteCommandError under ./test/driver.
func TestLSPProxySuppressesURILessStaleExecuteCommandError(t *testing.T) {
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
      return nil, errors.New("stale workspace fix failed")
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///a.ts","version":1,"languageId":"typescript","text":"const a = 1;\n"}}}`))
  _ = h.recvUpstream()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":28,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fixAll","arguments":[]}}`))
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
    Error  json.RawMessage `json:"error"`
    Result json.RawMessage `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("executeCommand response not JSON: %v\n%s", err, body)
  }
  if decoded.Error != nil || string(decoded.Result) != "null" {
    t.Fatalf("URI-less stale command failure was not suppressed:\n%s", body)
  }
}
