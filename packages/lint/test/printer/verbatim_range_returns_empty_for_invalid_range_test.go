package linthost

import "testing"

// TestVerbatimRangeReturnsEmptyForInvalidRange verifies that verbatimRange
// returns a zero Doc for each of the three invalid-input cases.
//
// verbatimRange is the position-only sibling of verbatim and is called by
// per-node printers whenever a sub-range does not correspond to a single
// AST node (e.g. the `<T>` punctuation around a type-argument list). Any
// of three conditions makes a slice panic: start < 0, end < start, or
// end > len(src). The guard catches all three and returns an empty Doc so
// the surrounding printer degrades gracefully. This test exercises all
// three branches independently, because each condition corresponds to a
// different caller mistake.
//
//  1. Call verbatimRange with start < 0 and assert a zero Doc.
//  2. Call verbatimRange with end < start and assert a zero Doc.
//  3. Call verbatimRange with end > len(src) and assert a zero Doc.
func TestVerbatimRangeReturnsEmptyForInvalidRange(t *testing.T) {
  src := "hello"

  // start < 0
  if doc := verbatimRange(src, -1, 3); !doc.IsNil() {
    t.Fatalf("start<0: want nil Doc, got Kind=%d", doc.Kind)
  }

  // end < start
  if doc := verbatimRange(src, 3, 1); !doc.IsNil() {
    t.Fatalf("end<start: want nil Doc, got Kind=%d", doc.Kind)
  }

  // end > len(src)
  if doc := verbatimRange(src, 0, len(src)+1); !doc.IsNil() {
    t.Fatalf("end>len(src): want nil Doc, got Kind=%d", doc.Kind)
  }
}
