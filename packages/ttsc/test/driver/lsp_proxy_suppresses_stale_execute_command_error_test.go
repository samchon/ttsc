package driver_test

import (
  "bytes"
  "encoding/json"
  "errors"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesStaleExecuteCommandError verifies command failures do
// not surface after the target document changed.
//
// A plugin command can fail after the user edits the document it was computing
// against. Successful stale edits already collapse to JSON null; stale failures
// should do the same so VSCode does not show an error toast for abandoned work.
//
// 1. Start an owned executeCommand request and block the plugin callback.
// 2. Send didChange for the same URI while the callback is blocked.
// 3. Release the callback with a plugin error.
// 4. Assert the response is JSON null rather than a JSON-RPC error.
func TestLSPProxySuppressesStaleExecuteCommandError(t *testing.T) {
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
      return nil, errors.New("stale fix failed")
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":27,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fixAll","arguments":["file:///a.ts"]}}`))
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
    Error  any `json:"error"`
    Result any `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("executeCommand response not JSON: %v\n%s", err, body)
  }
  if decoded.Error != nil || decoded.Result != nil {
    t.Fatalf("stale command failure was not suppressed:\n%s", body)
  }
}
