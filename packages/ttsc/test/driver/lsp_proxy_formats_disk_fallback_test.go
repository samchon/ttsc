package driver_test

import (
  "encoding/json"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// formattingContentCapture builds a stubSource that owns ttsc.format.document
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

// TestLSPProxyFormatsPatchedBufferAfterIncrementalDidChange Verifies that formatting receives the patched buffer rather than disk or the original open buffer.
//
// Disk, open, and patched strings differ; the response must be an empty TextEdit array with ID 11.
//
// 1. Write disk content and open a different cached buffer.
// 2. Replace stale with frag using a ranged didChange.
// 3. Request formatting and assert the capture uses the patched buffer instead of disk or the original buffer.
//
// @evidence contracts/testing.md#behavioral-verification Formatting receives the patched buffer rather than disk or the original open buffer.
// @evidence contracts/testing.md#independent-expectations Replacing authored columns 6 through 11 changes staleBuffer to fragBuffer independently of the patcher.
// @evidence contracts/testing.md#distinguishing-cases Disk, open, and patched strings differ; the response must be an empty TextEdit array with ID 11.
// @evidence contracts/testing.md#execution-ownership formattingContentCapture runs in the Go proxy harness and the disk file supplies only fallback input. Go discovers TestLSPProxyFormatsPatchedBufferAfterIncrementalDidChange under ./test/driver.
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

// TestLSPProxyFormatsDiskAfterRangedDidChangeWithoutBase Verifies that formatting reads disk after a ranged edit with no cached base.
//
// No didOpen precedes the change, contrasting the patched-buffer sibling.
//
// 1. Write a disk file and send a ranged didChange without a preceding didOpen.
// 2. Request formatting and assert an empty TextEdit response and the captured disk content.
//
// @evidence contracts/testing.md#behavioral-verification Formatting reads disk after a ranged edit with no cached base.
// @evidence contracts/testing.md#independent-expectations A ranged change cannot define a complete buffer without its base; literal disk text defines fallback.
// @evidence contracts/testing.md#distinguishing-cases No didOpen precedes the change, contrasting the patched-buffer sibling.
// @evidence contracts/testing.md#execution-ownership The Go proxy and capture callback use a temporary file as fallback input. Go discovers TestLSPProxyFormatsDiskAfterRangedDidChangeWithoutBase under ./test/driver.
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

// TestLSPProxyPatchesRangedDidChangeWithUTF16Offsets Verifies that formatting receives the exact buffer with OLD replaced by NEW.
//
// Emoji and CJK characters before the edit distinguish byte, rune, and UTF-16 indexing.
//
// 1. Open a buffer with an emoji and CJK character before OLD.
// 2. Replace UTF-16 columns 7 through 10 with NEW and request formatting.
// 3. Assert the capture equals the complete authored patched buffer.
//
// @evidence contracts/testing.md#behavioral-verification Formatting receives the exact buffer with OLD replaced by NEW.
// @evidence contracts/testing.md#independent-expectations The authored non-BMP character takes two UTF-16 units, defining columns 7 through 10 independently.
// @evidence contracts/testing.md#distinguishing-cases Emoji and CJK characters before the edit distinguish byte, rune, and UTF-16 indexing.
// @evidence contracts/testing.md#execution-ownership The Go pipe proxy patches the buffer and calls the in-process capture formatter. Go discovers TestLSPProxyPatchesRangedDidChangeWithUTF16Offsets under ./test/driver.
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

// TestLSPProxyFormatsDiskOnCacheMiss Verifies that formatting receives authored disk text when no buffer was opened.
//
// No open or change precedes formatting, isolating the cache-miss path.
//
// 1. Write a disk file without sending didOpen.
// 2. Request formatting and assert the empty response and captured disk bytes.
//
// @evidence contracts/testing.md#behavioral-verification Formatting receives authored disk text when no buffer was opened.
// @evidence contracts/testing.md#independent-expectations The literal fromDisk source defines fallback independently of the cache.
// @evidence contracts/testing.md#distinguishing-cases No open or change precedes formatting, isolating the cache-miss path.
// @evidence contracts/testing.md#execution-ownership The Go proxy reads a private file and calls the local capture callback. Go discovers TestLSPProxyFormatsDiskOnCacheMiss under ./test/driver.
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

// TestLSPProxyFormatsDiskAfterDidClose Verifies that formatting uses disk after didClose evicts a different cached buffer.
//
// Open followed by close contrasts with the never-opened cache-miss case.
//
// 1. Open a buffer different from disk and then send didClose.
// 2. Request formatting and assert the capture uses disk and returns an empty edit array.
//
// @evidence contracts/testing.md#behavioral-verification Formatting uses disk after didClose evicts a different cached buffer.
// @evidence contracts/testing.md#independent-expectations Distinct disk and open strings make stale retention observable independently.
// @evidence contracts/testing.md#distinguishing-cases Open followed by close contrasts with the never-opened cache-miss case.
// @evidence contracts/testing.md#execution-ownership The Go proxy, private disk input, and capture callback execute within the test process. Go discovers TestLSPProxyFormatsDiskAfterDidClose under ./test/driver.
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
