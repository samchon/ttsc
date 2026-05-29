package driver_test

import (
  "encoding/json"
  "errors"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

var errFormatterBoom = errors.New("formatter boom")

// TestLSPProxyFormatsCachedBuffer verifies the textDocument/formatting handler
// formats the live editor buffer. The proxy caches the buffer from didOpen /
// didChange and feeds it to ttsc.format.document via ExecuteCommandWithContent,
// then projects the returned WorkspaceEdit onto the formatting response shape
// ([]TextEdit for the requested uri).
//
// 1. Open and edit a document so the proxy caches the dirty buffer text.
// 2. Send textDocument/formatting; assert it is intercepted (not forwarded).
// 3. Assert the source received the cached buffer text via content.
// 4. Assert the editor response is the TextEdit array from changes[uri].
func TestLSPProxyFormatsCachedBuffer(t *testing.T) {
  const uri = "file:///a.ts"
  var gotContent string
  source := &stubSource{
    commands: []string{"ttsc.format.document"},
    executeWithContent: func(command string, args []json.RawMessage, content string) (*driver.LSPWorkspaceEdit, error) {
      gotContent = content
      return &driver.LSPWorkspaceEdit{
        Changes: map[string][]driver.LSPTextEdit{
          uri: {{
            Range:   driver.LSPRange{Start: driver.LSPPosition{Line: 0, Character: 0}, End: driver.LSPPosition{Line: 0, Character: 5}},
            NewText: "const formatted = 1;\n",
          }},
        },
      }, nil
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///a.ts","version":1,"text":"const x=1"}}}`))
  _ = h.recvUpstream()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didChange","params":{"textDocument":{"uri":"file:///a.ts","version":2},"contentChanges":[{"text":"const dirty=2"}]}}`))
  _ = h.recvUpstream()

  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":7,"method":"textDocument/formatting","params":{"textDocument":{"uri":"file:///a.ts"},"options":{"tabSize":2,"insertSpaces":true}}}`))
  h.expectNoUpstreamFrame(150 * time.Millisecond)

  body := h.recvEditor()
  var resp struct {
    ID     int                  `json:"id"`
    Result []driver.LSPTextEdit `json:"result"`
  }
  if err := json.Unmarshal(body, &resp); err != nil {
    t.Fatalf("formatting response not JSON: %v\n%s", err, body)
  }
  if resp.ID != 7 {
    t.Fatalf("formatting response id mismatch: %s", body)
  }
  if len(resp.Result) != 1 || resp.Result[0].NewText != "const formatted = 1;\n" {
    t.Fatalf("unexpected formatting TextEdits: %#v", resp.Result)
  }
  if gotContent != "const dirty=2" {
    t.Fatalf("source did not receive cached dirty buffer text, got %q", gotContent)
  }
}

// TestLSPProxyFormattingNoOpReturnsEmptyArray verifies a nil WorkspaceEdit (the
// formatter produced no changes) yields an empty, non-nil TextEdit array so the
// editor save is never broken.
func TestLSPProxyFormattingNoOpReturnsEmptyArray(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.format.document"},
    executeWithContent: func(string, []json.RawMessage, string) (*driver.LSPWorkspaceEdit, error) {
      return nil, nil
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///a.ts","version":1,"text":"const x=1"}}}`))
  _ = h.recvUpstream()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":3,"method":"textDocument/formatting","params":{"textDocument":{"uri":"file:///a.ts"}}}`))

  body := h.recvEditor()
  if string(body) != `{"jsonrpc":"2.0","id":3,"result":[]}` {
    t.Fatalf("expected empty TextEdit array, got: %s", body)
  }
}

// TestLSPProxyFormattingErrorReturnsEmptyArray verifies a formatter failure is
// swallowed into an empty TextEdit array rather than an LSP error response.
func TestLSPProxyFormattingErrorReturnsEmptyArray(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.format.document"},
    executeWithContent: func(string, []json.RawMessage, string) (*driver.LSPWorkspaceEdit, error) {
      return nil, errFormatterBoom
    },
  }
  h := newProxyHarness(t, source)

  h.sendEditor([]byte(`{"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":"file:///a.ts","version":1,"text":"x"}}}`))
  _ = h.recvUpstream()
  h.sendEditor([]byte(`{"jsonrpc":"2.0","id":9,"method":"textDocument/formatting","params":{"textDocument":{"uri":"file:///a.ts"}}}`))

  body := h.recvEditor()
  if string(body) != `{"jsonrpc":"2.0","id":9,"result":[]}` {
    t.Fatalf("expected empty TextEdit array on error, got: %s", body)
  }
}

// TestLSPProxyForwardsFormattingWhenUnowned verifies the proxy leaves
// textDocument/formatting to upstream tsgo when ttsc does not own the document
// formatter, so tsgo's own formatter keeps working in non-ttsc projects.
func TestLSPProxyForwardsFormattingWhenUnowned(t *testing.T) {
  source := &stubSource{commands: []string{"ttsc.lint.fixAll"}}
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/formatting","params":{"textDocument":{"uri":"file:///a.ts"}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); string(got) != string(request) {
    t.Fatalf("formatting request was not forwarded to upstream:\n%s", got)
  }
}
