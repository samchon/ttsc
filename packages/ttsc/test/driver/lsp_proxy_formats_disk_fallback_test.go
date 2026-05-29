package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// formattingNoEditStubSource builds a stubSource that owns ttsc.format.document
// and records the content the formatting handler piped to the formatter, while
// returning a nil WorkspaceEdit so the editor receives an empty TextEdit array.
// The captured content is what the assertions below inspect.
func formattingContentCapture(captured *string) *stubSource {
  return &stubSource{
    commands: []string{"ttsc.format.document"},
    executeWithContent: func(_ string, _ []json.RawMessage, content string) (*driver.LSPWorkspaceEdit, error) {
      *captured = content
      return nil, nil
    },
  }
}

// drainFormattingResponse reads the editor response to a formatting request and
// asserts it is the well-formed empty TextEdit array the handler produces for a
// nil WorkspaceEdit, confirming the request was intercepted (not forwarded).
func drainFormattingResponse(t *testing.T, h *proxyHarness, id int) {
  t.Helper()
  body := h.recvEditor()
  var resp struct {
    ID     int                  `json:"id"`
    Result []driver.LSPTextEdit `json:"result"`
  }
  if err := json.Unmarshal(body, &resp); err != nil {
    t.Fatalf("formatting response not JSON: %v\n%s", err, body)
  }
  if resp.ID != id {
    t.Fatalf("formatting response id mismatch: got %d, want %d\n%s", resp.ID, id, body)
  }
  if resp.Result == nil || len(resp.Result) != 0 {
    t.Fatalf("expected empty TextEdit array, got %#v", resp.Result)
  }
}

// TestLSPProxyFormatsDiskAfterIncrementalDidChange pins the incremental-sync
// eviction path. An incremental (ranged) didChange evicts the cached buffer in
// cacheDidChangeText, so completeFormattingRequest must fall back to reading the
// on-disk file rather than formatting the stale cached buffer or the incremental
// fragment.
//
// 1. didOpen populates the cache with a buffer that differs from disk.
// 2. A ranged didChange (a contentChange carrying a "range") evicts the cache.
// 3. The uri points at a real temp file with known disk content.
// 4. textDocument/formatting must feed the DISK content to the formatter.
func TestLSPProxyFormatsDiskAfterIncrementalDidChange(t *testing.T) {
  const diskContent = "const onDisk = 1;\n"
  uri := writeLSPDiskFile(t, diskContent)

  var gotContent string
  h := newProxyHarness(t, formattingContentCapture(&gotContent))

  openParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 1, "text": "const staleBuffer = 2;\n"},
  })
  h.sendEditor(notification("textDocument/didOpen", openParams))
  _ = h.recvUpstream()

  // Incremental didChange: the single contentChange carries a range, which the
  // proxy treats as incremental sync and evicts the cache for.
  changeParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 2},
    "contentChanges": []any{
      map[string]any{
        "range": map[string]any{
          "start": map[string]any{"line": 0, "character": 6},
          "end":   map[string]any{"line": 0, "character": 11},
        },
        "text": "frag",
      },
    },
  })
  h.sendEditor(notification("textDocument/didChange", changeParams))
  _ = h.recvUpstream()

  formatParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "options":      map[string]any{"tabSize": 2, "insertSpaces": true},
  })
  h.sendEditor(request(11, "textDocument/formatting", formatParams))
  h.expectNoUpstreamFrame(150 * time.Millisecond)

  drainFormattingResponse(t, h, 11)
  if gotContent != diskContent {
    t.Fatalf("formatter did not receive disk content after incremental didChange evicted the cache; got %q, want %q", gotContent, diskContent)
  }
}

// TestLSPProxyFormatsDiskOnCacheMiss pins the cache-miss path. With no prior
// didOpen the documentText cache has no entry, so cachedDocumentText returns
// !ok and completeFormattingRequest reads the on-disk file.
func TestLSPProxyFormatsDiskOnCacheMiss(t *testing.T) {
  const diskContent = "const fromDisk = 3;\n"
  uri := writeLSPDiskFile(t, diskContent)

  var gotContent string
  h := newProxyHarness(t, formattingContentCapture(&gotContent))

  formatParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "options":      map[string]any{"tabSize": 2, "insertSpaces": true},
  })
  h.sendEditor(request(12, "textDocument/formatting", formatParams))
  h.expectNoUpstreamFrame(150 * time.Millisecond)

  drainFormattingResponse(t, h, 12)
  if gotContent != diskContent {
    t.Fatalf("formatter did not receive disk content on cache miss; got %q, want %q", gotContent, diskContent)
  }
}

// TestLSPProxyFormatsDiskAfterDidClose pins the didClose eviction path.
// evictDocumentText drops the cached buffer on close, so a subsequent
// formatting request falls back to the on-disk file.
func TestLSPProxyFormatsDiskAfterDidClose(t *testing.T) {
  const diskContent = "const reopened = 4;\n"
  uri := writeLSPDiskFile(t, diskContent)

  var gotContent string
  h := newProxyHarness(t, formattingContentCapture(&gotContent))

  openParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 1, "text": "const closedBuffer = 5;\n"},
  })
  h.sendEditor(notification("textDocument/didOpen", openParams))
  _ = h.recvUpstream()

  closeParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
  })
  h.sendEditor(notification("textDocument/didClose", closeParams))
  _ = h.recvUpstream()

  formatParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "options":      map[string]any{"tabSize": 2, "insertSpaces": true},
  })
  h.sendEditor(request(13, "textDocument/formatting", formatParams))
  h.expectNoUpstreamFrame(150 * time.Millisecond)

  drainFormattingResponse(t, h, 13)
  if gotContent != diskContent {
    t.Fatalf("formatter did not receive disk content after didClose evicted the cache; got %q, want %q", gotContent, diskContent)
  }
}

// notification builds a JSON-RPC notification frame body for the given method.
func notification(method string, params json.RawMessage) []byte {
  body, _ := json.Marshal(map[string]any{
    "jsonrpc": "2.0",
    "method":  method,
    "params":  params,
  })
  return body
}

// request builds a JSON-RPC request frame body with a numeric id.
func request(id int, method string, params json.RawMessage) []byte {
  body, _ := json.Marshal(map[string]any{
    "jsonrpc": "2.0",
    "id":      id,
    "method":  method,
    "params":  params,
  })
  return body
}
