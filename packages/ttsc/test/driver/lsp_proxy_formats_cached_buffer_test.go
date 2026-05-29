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
  var gotHasContent bool
  source := &stubSource{
    commands: []string{"ttsc.format.document"},
    executeWithContent: func(command string, args []json.RawMessage, content string, hasContent bool) (*driver.LSPWorkspaceEdit, error) {
      gotContent = content
      gotHasContent = hasContent
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
  if !gotHasContent {
    t.Fatalf("a cache hit must set hasContent=true so the sidecar formats in-memory, not disk")
  }
}

// TestLSPProxyFormatsEmptyCachedBufferNotDisk pins the empty-buffer bug fix. When
// the user clears a file to empty the proxy caches ("", true). The empty string
// must NOT be mistaken for the no-buffer sentinel: the handler must format the
// (empty) live buffer in-memory with hasContent=true, never fall through to the
// stale, still-populated on-disk file.
//
//  1. Seed a real on-disk file with non-empty content.
//  2. didOpen + a full-text didChange that empties the buffer → cache holds "".
//  3. textDocument/formatting must feed the EMPTY buffer with hasContent=true,
//     not the old disk content.
func TestLSPProxyFormatsEmptyCachedBufferNotDisk(t *testing.T) {
  const diskContent = "const onDisk = 1;\n"
  uri := writeLSPDiskFile(t, diskContent)

  var gotContent string
  var gotHasContent bool
  var called bool
  source := &stubSource{
    commands: []string{"ttsc.format.document"},
    executeWithContent: func(_ string, _ []json.RawMessage, content string, hasContent bool) (*driver.LSPWorkspaceEdit, error) {
      called = true
      gotContent = content
      gotHasContent = hasContent
      return nil, nil
    },
  }
  h := newProxyHarness(t, source)

  openParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 1, "text": "const buffered = 2;\n"},
  })
  h.sendEditor(notification("textDocument/didOpen", openParams))
  _ = h.recvUpstream()

  // Full-text (no range) didChange emptying the buffer caches ("", true).
  changeParams, _ := json.Marshal(map[string]any{
    "textDocument":   map[string]any{"uri": uri, "version": 2},
    "contentChanges": []any{map[string]any{"text": ""}},
  })
  h.sendEditor(notification("textDocument/didChange", changeParams))
  _ = h.recvUpstream()

  formatParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "options":      map[string]any{"tabSize": 2, "insertSpaces": true},
  })
  h.sendEditor(request(21, "textDocument/formatting", formatParams))
  h.expectNoUpstreamFrame(150 * time.Millisecond)

  drainFormattingResponse(t, h, 21)
  if !called {
    t.Fatal("formatter was not invoked for the emptied buffer")
  }
  if !gotHasContent {
    t.Fatal("emptied buffer must format in-memory (hasContent=true), not fall through to disk")
  }
  if gotContent != "" {
    t.Fatalf("formatter received non-empty content %q; the empty live buffer must win over disk", gotContent)
  }
}

// TestLSPProxyFormatsDirtyBufferOverPopulatedDisk pins the feature's central
// promise: a dirty (non-empty) cached buffer wins over a populated on-disk file.
// The earlier cached-buffer test uses a synthetic file:// uri with no backing
// file, so it never proves the buffer beats real disk content; this one seeds
// differing disk content and asserts the formatter sees the buffer, not disk.
func TestLSPProxyFormatsDirtyBufferOverPopulatedDisk(t *testing.T) {
  const diskContent = "const onDisk = 1;\n"
  const bufferContent = "const dirtyBuffer = 2;\n"
  uri := writeLSPDiskFile(t, diskContent)

  var gotContent string
  var gotHasContent bool
  source := &stubSource{
    commands: []string{"ttsc.format.document"},
    executeWithContent: func(_ string, _ []json.RawMessage, content string, hasContent bool) (*driver.LSPWorkspaceEdit, error) {
      gotContent = content
      gotHasContent = hasContent
      return nil, nil
    },
  }
  h := newProxyHarness(t, source)

  openParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 1, "text": bufferContent},
  })
  h.sendEditor(notification("textDocument/didOpen", openParams))
  _ = h.recvUpstream()

  formatParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "options":      map[string]any{"tabSize": 2, "insertSpaces": true},
  })
  h.sendEditor(request(22, "textDocument/formatting", formatParams))
  h.expectNoUpstreamFrame(150 * time.Millisecond)

  drainFormattingResponse(t, h, 22)
  if !gotHasContent {
    t.Fatal("a cached buffer must format in-memory (hasContent=true)")
  }
  if gotContent != bufferContent {
    t.Fatalf("formatter received %q; the dirty buffer must win over disk content %q", gotContent, diskContent)
  }
}

// TestLSPProxyFormattingNoOpReturnsEmptyArray verifies a nil WorkspaceEdit (the
// formatter produced no changes) yields an empty, non-nil TextEdit array so the
// editor save is never broken.
func TestLSPProxyFormattingNoOpReturnsEmptyArray(t *testing.T) {
  source := &stubSource{
    commands: []string{"ttsc.format.document"},
    executeWithContent: func(string, []json.RawMessage, string, bool) (*driver.LSPWorkspaceEdit, error) {
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
    executeWithContent: func(string, []json.RawMessage, string, bool) (*driver.LSPWorkspaceEdit, error) {
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
