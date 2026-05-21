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
//  2. Find the literal node; note that its End() position is near the end
//     of the source string.
//  3. Build a PrintContext with Source truncated to just past the node's
//     Pos() but before its End(), so the guard fires.
//  4. Call verbatim directly and assert a zero Doc is returned.
func TestVerbatimReturnsEmptyForOutOfRangeNode(t *testing.T) {
  src := "const x = 42;\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindNumericLiteral)
  // Truncate Source to one byte past the node's starting position so
  // SkipTrivia can advance to the non-trivia start, but node.End()
  // still exceeds len(truncated). The numeric literal `42` starts
  // at position 10 and ends at 12, so truncating to 11 bytes
  // makes end(12) > len(11) true without panicking in SkipTrivia.
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
