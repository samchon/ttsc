package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVerbatimReturnsEmptyForOutOfRangeNode verifies that verbatim returns
// a zero Doc when the node's byte range extends beyond the source string
// stored in the PrintContext.
//
// A context is normally built from the same file it will print, so the
// positions are always valid. However, a caller that constructs a context
// manually (e.g. a unit test or a reflowing helper that substitutes a
// trimmed source) may produce a mismatch. The guard (`end > len(ctx.Source)`)
// defends against that: it returns an empty Doc rather than a slice-bounds
// panic. The test crafts a PrintContext whose Source field is truncated so
// that node.End() exceeds len(ctx.Source) while still being long enough for
// SkipTrivia to scan forward from node.Pos() without panicking.
//
//  1. Parse a TypeScript source containing a numeric literal.
//  2. Find the literal node; its Pos() is 9 (the full start, including the
//     leading space) and its End() is 12.
//  3. Build a PrintContext with Source truncated to Pos()+1 = 10 bytes,
//     which stops right before the literal's first byte, so End() exceeds
//     the shortened source and the guard fires.
//  4. Call verbatim directly and assert a zero Doc is returned.
//
// @evidence contracts/testing.md#behavioral-verification verbatim must reject a parsed numeric literal whose End exceeds the shortened context source.
// @evidence contracts/testing.md#independent-expectations The context source is cut to ten bytes, const x = followed by a space, which ends immediately before the first byte of the literal 42 (parsed Pos 9, End 12); a copy of the node span would need bytes ten and eleven, so only a bounds guard can return the empty Doc.
// @evidence contracts/testing.md#distinguishing-cases An intact parsed node paired with a truncated source exercises the invalid-end boundary, distinct from absent node and ordinary unknown-kind fallback.
// @evidence contracts/testing.md#execution-ownership TestVerbatimReturnsEmptyForOutOfRangeNode is one Go unit entry that parses a small source in-process with the TypeScript-Go parser, builds a PrintContext over a truncated copy of its text and calls the unexported verbatim; it installs, builds and launches nothing.
func TestVerbatimReturnsEmptyForOutOfRangeNode(t *testing.T) {
  src := "const x = 42;\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindNumericLiteral)
  // Truncate Source to one byte past the node's full start (Pos() is 9, the
  // space before `42`) so SkipTrivia can advance over that space to the
  // literal's first byte at offset 10, while node.End() (12) still exceeds
  // len(truncated) (10). SkipTrivia therefore does not read out of bounds.
  truncated := src[:node.Pos()+1]
  ctx := &PrintContext{
    File:   file,
    Source: truncated,
    Opts:   DefaultPrintOptions(),
  }
  doc := verbatim(ctx, node)
  if !doc.IsNil() {
    t.Fatalf("want nil Doc when end > len(source), got Kind=%d", doc.Kind)
  }
}
