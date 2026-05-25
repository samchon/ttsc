package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPProxySuppressesDirtyDocumentExecuteCommandResultEdit verifies command
// result edits are checked even when arguments do not name a document URI.
//
// Third-party command arguments may be opaque. Dirty protection therefore must
// inspect the returned `WorkspaceEdit` targets as well as the input arguments
// before handing edits to the editor.
//
// 1. Mark a document dirty.
// 2. Execute an owned command with no URI argument.
// 3. Return an edit targeting the dirty URI.
// 4. Assert the command ran but the proxy returns null.
func TestLSPProxySuppressesDirtyDocumentExecuteCommandResultEdit(t *testing.T) {
  called := false
  h := newProxyHarness(t, &stubSource{
    commands: []string{"ttsc.custom.fix"},
    execute: func(string, []json.RawMessage) (*driver.LSPWorkspaceEdit, error) {
      called = true
      return &driver.LSPWorkspaceEdit{Changes: map[string][]driver.LSPTextEdit{
        "file:///a.ts": {{
          Range:   driver.LSPRange{},
          NewText: "changed",
        }},
      }}, nil
    },
  })

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty = 1;"}]}}`))
  _ = h.recvUpstream()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":1,"method":"workspace/executeCommand","params":{"command":"ttsc.custom.fix","arguments":[]}}`))
  body := h.recvEditor()
  var decoded struct {
    Result json.RawMessage `json:"result"`
  }
  if err := json.Unmarshal(body, &decoded); err != nil {
    t.Fatalf("executeCommand response not JSON: %v\n%s", err, body)
  }
  if string(decoded.Result) != "null" {
    t.Fatalf("dirty result edit was not suppressed: %s", body)
  }
  if !called {
    t.Fatal("source ExecuteCommand was not called")
  }
}
