package driver_test

import (
  "bytes"
  "encoding/json"
  "sync/atomic"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxyExecuteCommandDropsEditAfterDocumentClose verifies command edits
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
func TestLSPProxyExecuteCommandDropsEditAfterDocumentClose(t *testing.T) {
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
  close(release)

  body := h.recvEditor()
  var decoded struct {
    Result any `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("executeCommand response not JSON: %v\n%s", err, body)
  }
  if decoded.Result != nil {
    t.Fatalf("closed-document command response was not suppressed:\n%s", body)
  }
}
