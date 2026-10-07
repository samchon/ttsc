package lspserver

import "testing"

// TestLSPIndexByteFromBoundsItsSearchStart checks the helper's search boundaries.
//
// An out-of-range start must simply find nothing. Slicing before delegating to
// strings.IndexByte would panic on those cases. No active position conversion
// calls this helper; the unit does not certify offsetForPosition or a request.
//
//  1. Search from inside, at, and past the end of a buffer.
//  2. Search from a negative start.
//  3. Assert every answer is the offset the caller can index with, or -1.
//
// @evidence contracts/testing.md#behavioral-verification Actual indexByteFrom returns six literal offsets for newline searches with start, interior, after-last-newline, EOF, past-EOF and negative starts, plus -1 for an empty buffer. A panic fails these calls; other target bytes or arbitrary integer/string inputs are not certified.
// @evidence contracts/testing.md#independent-expectations Expected offsets are literals for each start position.
// @evidence contracts/testing.md#distinguishing-cases Inside, end, past-end and negative starts are the boundary inputs.
// @evidence contracts/testing.md#execution-ownership This Go unit directly calls the actual package-local string helper with authored strings/start offsets and compares literal integers. It substitutes no operation and creates no directory or sidecar; no compiler, process, product host, position-conversion caller or LSP transport runs.
func TestLSPIndexByteFromBoundsItsSearchStart(t *testing.T) {
  const text = "alpha\nbeta\ngamma"
  for _, entry := range []struct {
    name string
    from int
    want int
  }{
    {"from the start", 0, 5},
    {"past the first newline", 6, 10},
    {"after the last newline", 11, -1},
    {"exactly at the end", len(text), -1},
    {"past the end", len(text) + 8, -1},
    {"negative start", -4, 5},
  } {
    if got := indexByteFrom(text, entry.from, '\n'); got != entry.want {
      t.Fatalf("%s: want %d, got %d", entry.name, entry.want, got)
    }
  }
  if got := indexByteFrom("", 0, '\n'); got != -1 {
    t.Fatalf("empty buffer: want -1, got %d", got)
  }
}
