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
//
// @evidence contracts/testing.md#behavioral-verification verbatimRange must reject invalid bounds but copy valid interior/full source bytes and permit an empty range.
// @evidence contracts/testing.md#independent-expectations The literal hello and independently authored ell substring establish valid output without invoking the implementation as an oracle.
// @evidence contracts/testing.md#distinguishing-cases Negative start, reversed endpoints and end beyond source contrast with interior, complete and zero-length valid ranges.
// @evidence contracts/testing.md#execution-ownership TestVerbatimRangeReturnsEmptyForInvalidRange is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
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
  if got := Print(verbatimRange(src, 1, 4), DefaultPrintOptions()); got != "ell" {
    t.Fatalf("valid interior range must preserve ell, got %q", got)
  }
  if got := Print(verbatimRange(src, 0, len(src)), DefaultPrintOptions()); got != src {
    t.Fatalf("full source range must preserve hello, got %q", got)
  }
  if got := Print(verbatimRange(src, 2, 2), DefaultPrintOptions()); got != "" {
    t.Fatalf("valid empty range must emit nothing, got %q", got)
  }
}
