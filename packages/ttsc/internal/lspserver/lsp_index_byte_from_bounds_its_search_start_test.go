package lspserver

import "testing"

// TestLSPIndexByteFromBoundsItsSearchStart verifies the line scanner behind
// offsetForPosition answers identically at and past the edges of the buffer.
//
// The hand-rolled loop this replaced started at `from` and compared `from <
// len(text)` on every step, so an out-of-range start simply fell out of the
// loop. Slicing before delegating to strings.IndexByte would panic on the same
// input, and the position path reaches it for a cursor on the last line of a
// buffer that has no trailing newline.
//
//  1. Search from inside, at, and past the end of a buffer.
//  2. Search from a negative start.
//  3. Assert every answer is the offset the caller can index with, or -1.
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
