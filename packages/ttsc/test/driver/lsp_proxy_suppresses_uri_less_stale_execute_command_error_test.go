package driver_test

import (
  "encoding/json"
  "errors"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesURILessStaleExecuteCommandError verifies workspace
// command failures are dropped after document generations change.
//
// Some owned commands have no URI argument. The proxy snapshots all open
// document generations for those commands so successful stale edits can be
// suppressed; stale failures should also collapse to JSON null.
//
// 1. Start an owned executeCommand request with no URI arguments.
// 2. Send didChange and didSave while the plugin callback is blocked.
// 3. Release the callback with a plugin error.
// 4. Assert the response is JSON null rather than a JSON-RPC error.
func TestLSPProxySuppressesURILessStaleExecuteCommandError(t *testing.T) {
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
    t.Fatalf("URI-less stale command failure was not suppressed:\n%s", body)
  }
}
