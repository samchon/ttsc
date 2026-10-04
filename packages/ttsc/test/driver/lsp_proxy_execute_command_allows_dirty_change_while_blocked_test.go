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

// TestLSPProxyExecuteCommandAllowsDirtyChangeWhileBlocked Verifies command
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
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards didChange byte-for-byte while ExecuteCommand is blocked, then returns null instead of the disk-backed edit.
// @evidence contracts/testing.md#independent-expectations A change received during command work must remain live and invalidate the saved-file edit; literal change bytes and null response provide the oracle.
// @evidence contracts/testing.md#distinguishing-cases The command starts clean, the same URI becomes dirty before callback release, and the result is suppressed; initially dirty requests have separate coverage.
// @evidence contracts/testing.md#execution-ownership Go test/driver runs the proxy with pipe transport and channel-gated stub command, without a product command process.
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
  var releaseOnce sync.Once
  releaseCallback := func() { releaseOnce.Do(func() { close(release) }) }
  t.Cleanup(releaseCallback)

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
    t.Fatalf("dirty command response was not suppressed:\n%s", body)
  }
  var members map[string]json.RawMessage
  if err := json.Unmarshal(body, &members); err != nil {
    t.Fatalf("command response members are not JSON: %v", err)
  }
  if decoded.ID != 20 || !bytes.Equal(bytes.TrimSpace(members["result"]), []byte("null")) {
    t.Fatalf("dirty command must receive its correlated explicit null result: %s", body)
  }
}
