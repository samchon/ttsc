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

// TestLSPProxyExecuteCommandDropsEditAfterDocumentClose Verifies command edits
// remain tied to the document generation they started from.
//
// A disk-backed command can start without URI arguments, then the editor can
// close the document before the sidecar returns an edit for it. The document is
// not dirty anymore, but the command still computed against a stale snapshot,
// so the proxy must suppress the edit.
//
// 1. Start an owned executeCommand request with no URI arguments.
// 2. Send didClose for the same URI.
// 3. Release the callback.
// 4. Assert the command response is null.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns null for a returned edit targeting a document closed during work.
// @evidence contracts/testing.md#independent-expectations The returned target is stale even though input arguments contain no URI.
// @evidence contracts/testing.md#distinguishing-cases An empty argument list and a close-before-release transition isolate invalidation through the returned edit target, not URI arguments.
// @evidence contracts/testing.md#execution-ownership Go unit TestLSPProxyExecuteCommandDropsEditAfterDocumentClose in test/driver invokes NewProxy and Proxy.Run on in-memory pipes with injected sources/providers. No installed editor, sidecar or upstream process is launched.
func TestLSPProxyExecuteCommandDropsEditAfterDocumentClose(t *testing.T) {
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

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":22,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fixAll","arguments":[]}}`))
  select {
  case <-started:
  case <-time.After(2 * time.Second):
    t.Fatal("executeCommand did not start")
  }
  closeMessage := []byte(`{"jsonrpc":"2.0","method":"textDocument/didClose","params":{"textDocument":{"uri":"file:///a.ts"}}}`)
  h.sendEditor(closeMessage)
  if got := h.recvUpstream(); !bytes.Equal(got, closeMessage) {
    t.Fatalf("didClose did not reach upstream before command completed:\n%s", got)
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
    t.Fatalf("closed-document command response was not suppressed:\n%s", body)
  }
  var members map[string]json.RawMessage
  if err := json.Unmarshal(body, &members); err != nil {
    t.Fatalf("command response members are not JSON: %v", err)
  }
  if decoded.ID != 22 || !bytes.Equal(bytes.TrimSpace(members["result"]), []byte("null")) {
    t.Fatalf("closed-target command must receive its correlated explicit null: %s", body)
  }
}
