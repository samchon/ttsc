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
    executeWithContent: func(_ string, _ []json.RawMessage, content string, _ bool) (*driver.LSPWorkspaceEdit, error) {
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

// TestLSPProxyFormatsPatchedBufferAfterIncrementalDidChange pins the two-save
// regression. VS Code with tsgo uses incremental sync, so edits arrive as
// ranged didChange notifications. The proxy must splice each ranged change into
// the cached buffer so that, on save, textDocument/formatting formats the live
// (patched) buffer rather than falling back to the previous save on disk.
//
//  1. didOpen populates the cache with a buffer that differs from disk.
//  2. A ranged didChange edits the buffer in place ("stale" -> "frag").
//  3. The uri points at a real temp file with stale disk content.
//  4. textDocument/formatting must feed the PATCHED live buffer to the
//     formatter — not disk, and not the pre-edit buffer text.
func TestLSPProxyFormatsPatchedBufferAfterIncrementalDidChange(t *testing.T) {
  const diskContent = "const onDisk = 1;\n"
  // didOpen buffer; chars [6,11) on line 0 are "stale".
  const openBuffer = "const staleBuffer = 2;\n"
  // After splicing "frag" over [6,11) the live buffer reads "fragBuffer".
  const patchedBuffer = "const fragBuffer = 2;\n"
  uri := writeLSPDiskFile(t, diskContent)

  var gotContent string
  h := newProxyHarness(t, formattingContentCapture(&gotContent))

  openParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 1, "text": openBuffer},
  })
  h.sendEditor(notification("textDocument/didOpen", openParams))
  _ = h.recvUpstream()

  // Incremental (ranged) didChange: replace "stale" with "frag".
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
  if gotContent == diskContent {
    t.Fatalf("formatter received disk content %q; the live patched buffer must win (two-save bug regression)", gotContent)
  }
  if gotContent == openBuffer {
    t.Fatalf("formatter received the pre-edit buffer %q; the ranged change must be applied to the cache", gotContent)
  }
  if gotContent != patchedBuffer {
    t.Fatalf("formatter did not receive the patched live buffer; got %q, want %q", gotContent, patchedBuffer)
  }
}

// TestLSPProxyFormatsDiskAfterRangedDidChangeWithoutBase pins the
// cannot-patch-without-base fallback. A ranged didChange that arrives with no
// cached base entry (no prior didOpen) cannot be applied reliably, so the proxy
// drops any entry and the formatting handler falls back to reading disk.
func TestLSPProxyFormatsDiskAfterRangedDidChangeWithoutBase(t *testing.T) {
  const diskContent = "const onDisk = 1;\n"
  uri := writeLSPDiskFile(t, diskContent)

  var gotContent string
  h := newProxyHarness(t, formattingContentCapture(&gotContent))

  // No didOpen: the cache has no base entry for uri. A ranged change here
  // cannot be patched, so the cache stays empty and formatting reads disk.
  changeParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 2},
    "contentChanges": []any{
      map[string]any{
        "range": map[string]any{
          "start": map[string]any{"line": 0, "character": 0},
          "end":   map[string]any{"line": 0, "character": 5},
        },
        "text": "x",
      },
    },
  })
  h.sendEditor(notification("textDocument/didChange", changeParams))
  _ = h.recvUpstream()

  formatParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "options":      map[string]any{"tabSize": 2, "insertSpaces": true},
  })
  h.sendEditor(request(14, "textDocument/formatting", formatParams))
  h.expectNoUpstreamFrame(150 * time.Millisecond)

  drainFormattingResponse(t, h, 14)
  if gotContent != diskContent {
    t.Fatalf("formatter did not receive disk content for a ranged change without a cached base; got %q, want %q", gotContent, diskContent)
  }
}

// TestLSPProxyPatchesRangedDidChangeWithUTF16Offsets pins UTF-16 correctness.
// LSP Position.character is a UTF-16 code-unit offset, not a byte or rune
// offset. The buffer contains a non-BMP emoji (U+1F600, two UTF-16 code units,
// four UTF-8 bytes) and a CJK char before the edit point, so a naive byte- or
// rune-based splice would land at the wrong place and corrupt the buffer. The
// ranged change targets the identifier after those characters; the splice must
// land exactly on it.
func TestLSPProxyPatchesRangedDidChangeWithUTF16Offsets(t *testing.T) {
  const diskContent = "const onDisk = 1;\n"
  uri := writeLSPDiskFile(t, diskContent)

  // Line 0 code units: `// 😀漢 ` then `OLD`.
  //   '/'=0 '/'=1 ' '=2 '😀'=3,4 (two UTF-16 units) '漢'=5 ' '=6 'O'=7 'L'=8 'D'=9
  // The edit replaces "OLD" at UTF-16 columns [7,10) with "NEW".
  const openBuffer = "// \U0001F600漢 OLD\nconst y = 2;\n"
  const patchedBuffer = "// \U0001F600漢 NEW\nconst y = 2;\n"

  var gotContent string
  h := newProxyHarness(t, formattingContentCapture(&gotContent))

  openParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 1, "text": openBuffer},
  })
  h.sendEditor(notification("textDocument/didOpen", openParams))
  _ = h.recvUpstream()

  changeParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri, "version": 2},
    "contentChanges": []any{
      map[string]any{
        "range": map[string]any{
          "start": map[string]any{"line": 0, "character": 7},
          "end":   map[string]any{"line": 0, "character": 10},
        },
        "text": "NEW",
      },
    },
  })
  h.sendEditor(notification("textDocument/didChange", changeParams))
  _ = h.recvUpstream()

  formatParams, _ := json.Marshal(map[string]any{
    "textDocument": map[string]any{"uri": uri},
    "options":      map[string]any{"tabSize": 2, "insertSpaces": true},
  })
  h.sendEditor(request(15, "textDocument/formatting", formatParams))
  h.expectNoUpstreamFrame(150 * time.Millisecond)

  drainFormattingResponse(t, h, 15)
  if gotContent != patchedBuffer {
    t.Fatalf("UTF-16 splice landed at the wrong byte offset; got %q, want %q", gotContent, patchedBuffer)
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
