package driver_test

import (
  "encoding/json"
  "errors"
  "strconv"
  "sync"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesURILessStaleExecuteCommandErrorAfterCleanOpen Verifies
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
// 4. Release the error callback and require no non-nil result or error field.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns a response with neither non-nil error nor result after a clean-open document changes and saves during a blocked URI-less command.
// @evidence contracts/testing.md#independent-expectations A command without URI arguments still depends on known document generations; its stale callback error must not be shown after those generations change.
// @evidence contracts/testing.md#distinguishing-cases Clean disk-equal open, URI-less request, dirty change, save and released error own the clean-open generation transition; response field absence versus explicit null is not distinguished.
// @evidence contracts/testing.md#execution-ownership Go test/driver uses a real file fixture and channel-gated stub through the pipe proxy, without native command execution.
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
  var releaseOnce sync.Once
  releaseCallback := func() { releaseOnce.Do(func() { close(release) }) }
  t.Cleanup(releaseCallback)
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
  releaseCallback()

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
