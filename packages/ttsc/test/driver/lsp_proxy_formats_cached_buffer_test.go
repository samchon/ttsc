package driver_test

import (
  "encoding/json"
  "errors"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

var errFormatterBoom = errors.New("formatter boom")

// TestLSPProxyFormatsCachedBuffer Verifies the textDocument/formatting handler
// formats the live editor buffer. The proxy caches the buffer from didOpen /
// didChange and feeds it to ttsc.format.document via ExecuteCommandWithContent,
// then projects the returned WorkspaceEdit onto the formatting response shape
// ([]TextEdit for the requested uri).
//
// 1. Open and edit a document so the proxy caches the dirty buffer text.
// 2. Send textDocument/formatting; assert it is intercepted (not forwarded).
// 3. Assert the source received the cached buffer text via content.
// 4. Assert the editor response is the TextEdit array from changes[uri].
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run dispatches formatting locally, passes const dirty=2 with hasContent true and returns the one authored TextEdit with id 7.
// @evidence contracts/testing.md#independent-expectations The last editor buffer is authoritative for formatting, and the literal stub edit must be projected onto the requested URI response.
// @evidence contracts/testing.md#distinguishing-cases A didOpen followed by dirty full-text didChange owns cached nonempty content; empty and populated-disk contrasts are separate cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver runs the pipe proxy with an injected content formatter, without a formatter sidecar; local routing is observed for 150ms.
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

// TestLSPProxyFormatsEmptyCachedBufferNotDisk Verifies empty-buffer formatting. When
// the user clears a file to empty the proxy caches ("", true). The empty string
// must NOT be mistaken for the no-buffer sentinel: the handler must format the
// (empty) live buffer in-memory with hasContent=true, never fall through to the
// stale, still-populated on-disk file.
//
//  1. Seed a real on-disk file with non-empty content.
//  2. didOpen + a full-text didChange that empties the buffer → cache holds "".
//  3. textDocument/formatting must feed the EMPTY buffer with hasContent=true,
//     not the old disk content.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run invokes the formatter with empty content and hasContent true after a buffer clear, while a populated disk file remains.
// @evidence contracts/testing.md#independent-expectations An empty live buffer is a present value rather than cache absence; the authored nonempty disk text makes fallback distinguishable.
// @evidence contracts/testing.md#distinguishing-cases Populated disk, populated opening buffer and then empty changed buffer exercise the empty-cache-hit boundary.
// @evidence contracts/testing.md#execution-ownership The Go test/driver proxy harness uses a temporary saved file and content callback; no installed formatter is invoked.
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

// TestLSPProxyFormatsDirtyBufferOverPopulatedDisk Verifies the cached-buffer
// promise: a dirty (non-empty) cached buffer wins over a populated on-disk file.
// The earlier cached-buffer test uses a synthetic file:// uri with no backing
// file, so it never proves the buffer beats real disk content; this one seeds
// differing disk content and asserts the formatter sees the buffer, not disk.
//
// 1. Seed a saved file and open it with different nonempty buffer text.
// 2. Request formatting and drain its response.
// 3. Require hasContent true and the dirty buffer text at the formatter.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run passes the literal dirtyBuffer text with hasContent true even though the temporary file contains different onDisk text.
// @evidence contracts/testing.md#independent-expectations Formatting must use the cached editor buffer over saved content; independently authored unequal strings detect disk substitution.
// @evidence contracts/testing.md#distinguishing-cases A nonempty buffer differs from nonempty disk, complementing the empty-buffer and synthetic-URI cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver directly runs the pipe proxy and records the injected content formatter arguments against a real file fixture.
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

// TestLSPProxyFormattingNoOpReturnsEmptyArray Verifies a nil WorkspaceEdit (the
// formatter produced no changes) yields an empty, non-nil TextEdit array so the
// editor save is never broken.
//
// 1. Open a buffer with an owned formatter returning no edit.
// 2. Require the exact id-3 response with an empty result array.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns the exact id-3 JSON response with result [] when the formatter supplies nil edit and nil error.
// @evidence contracts/testing.md#independent-expectations An unchanged document has an empty TextEdit array, not null or an error; the literal JSON response is independent of response serialization.
// @evidence contracts/testing.md#distinguishing-cases The nil-success formatter branch is covered; formatter error and nonempty edits are covered by neighboring cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver uses the pipe proxy and a no-op content formatter callback without launching a formatter process.
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

// TestLSPProxyFormattingErrorReturnsEmptyArray Verifies a formatter failure is
// swallowed into an empty TextEdit array rather than an LSP error response.
//
// 1. Open a buffer with an owned formatter returning formatter boom.
// 2. Require the exact id-9 response with an empty result array.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run returns the exact id-9 JSON response with result [] when the formatter returns formatter boom.
// @evidence contracts/testing.md#independent-expectations Formatting failure policy returns an empty edit set to preserve the editor operation; the literal expected response distinguishes error/null serialization.
// @evidence contracts/testing.md#distinguishing-cases An injected formatter error owns this branch, contrasted with nil-success and actual edit responses in peer tests.
// @evidence contracts/testing.md#execution-ownership The Go test/driver unit executes the actual proxy over pipes with an injected failing formatter, not a native formatter producer.
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

// TestLSPProxyForwardsFormattingWhenUnowned Verifies the proxy leaves
// textDocument/formatting to upstream tsgo when ttsc does not own the document
// formatter, so tsgo's own formatter keeps working in non-ttsc projects.
//
// 1. Configure a source that owns lint but not document formatting.
// 2. Require its formatting request to reach upstream byte-for-byte.
//
// @evidence contracts/testing.md#behavioral-verification Proxy.Run forwards the formatting request bytes unchanged when the source owns only lint fix-all.
// @evidence contracts/testing.md#independent-expectations A source without the document formatter command must leave formatting to upstream; the literal request is the forwarding oracle.
// @evidence contracts/testing.md#distinguishing-cases This owns the unowned formatter path; tests with ttsc.format.document own local formatting behavior.
// @evidence contracts/testing.md#execution-ownership Go test/driver uses the in-process pipe proxy and a non-formatting stub source, without starting the upstream server.
func TestLSPProxyForwardsFormattingWhenUnowned(t *testing.T) {
  source := &stubSource{commands: []string{"ttsc.lint.fixAll"}}
  h := newProxyHarness(t, source)

  request := []byte(`{"jsonrpc":"2.0","id":2,"method":"textDocument/formatting","params":{"textDocument":{"uri":"file:///a.ts"}}}`)
  h.sendEditor(request)
  if got := h.recvUpstream(); string(got) != string(request) {
    t.Fatalf("formatting request was not forwarded to upstream:\n%s", got)
  }
}
