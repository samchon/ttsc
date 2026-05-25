package driver_test

import (
  "encoding/json"
  "errors"
  "strconv"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesURILessStaleExecuteCommandErrorAfterCleanOpen verifies
// clean-open documents participate in URI-less command stale checks.
//
// URI-less commands snapshot every known document generation. A clean
// `didOpen` used to leave no generation entry, so a later document change
// could happen while a command was running and the command error would still be
// shown to the editor instead of collapsing to a stale null result.
//
// 1. Open a real disk-backed document whose text matches disk.
// 2. Start an owned URI-less executeCommand and block its plugin callback.
// 3. Change and save the open document while the command is blocked.
// 4. Release the callback with an error and assert the response is JSON null.
func TestLSPProxySuppressesURILessStaleExecuteCommandErrorAfterCleanOpen(t *testing.T) {
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
      return nil, errors.New("stale clean-open workspace fix failed")
    },
  }
  h := newProxyHarness(t, source)
  uri := writeLSPDiskFile(t, "const a = 1;\n")

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":` + strconv.Quote(uri) + `,"version":1,"languageId":"typescript","text":"const a = 1;\n"}}}`))
  _ = h.recvUpstream()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":29,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fixAll","arguments":[]}}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("executeCommand did not start")
  }
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":` + strconv.Quote(uri) + `,"version":2},"contentChanges":[{"text":"dirty"}]}}`))
  _ = h.recvUpstream()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didSave","params":{"textDocument":{"uri":` + strconv.Quote(uri) + `,"version":2}}}`))
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
    t.Fatalf("URI-less stale command failure after clean open was not suppressed:\n%s", body)
  }
}
