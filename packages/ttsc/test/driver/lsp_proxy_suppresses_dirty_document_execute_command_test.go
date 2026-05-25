package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesDirtyDocumentExecuteCommand verifies saved-file
// WorkspaceEdits are not returned for dirty document command arguments.
//
// The built-in VS Code command bridge passes the document URI as an execute
// command argument. While that URI is dirty, plugin sidecars would compute edits
// from disk and risk patching the wrong buffer, so the proxy returns null
// without invoking the sidecar command.
//
// 1. Mark a document dirty with didChange.
// 2. Execute an owned command whose argument is that URI.
// 3. Assert the source command is not called and the response is null.
func TestLSPProxySuppressesDirtyDocumentExecuteCommand(t *testing.T) {
  called := false
  h := newProxyHarness(t, &stubSource{
    commands: []string{"ttsc.lint.fixAll"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      called = true
      return &driver.LSPWorkspaceEdit{Changes: map[string][]driver.LSPTextEdit{"file:///a.ts": {}}}, nil
    },
  })

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty = 1;"}]}}`))
  _ = h.recvUpstream()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"workspace/executeCommand","params":{"command":"ttsc.lint.fixAll","arguments":["file:///a.ts"]}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)
  body := h.recvEditor()
  var decoded struct {
    Result json.RawMessage `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("executeCommand response not JSON: %v\n%s", err, body)
  }
  if string(decoded.Result) != "null" {
    t.Fatalf("dirty executeCommand result: want null, got %s", decoded.Result)
  }
  if called {
    t.Fatal("source ExecuteCommand was called for a dirty document")
  }
}
