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
//
// @evidence contracts/testing.md#behavioral-verification verbatim must reject a parsed numeric literal whose End exceeds the shortened context source.
// @evidence contracts/testing.md#independent-expectations The independently shortened source ends inside the numeric token; copying a complete source span would exceed its bounds.
// @evidence contracts/testing.md#distinguishing-cases An intact parsed node paired with a truncated source exercises the invalid-end boundary, distinct from absent node and ordinary unknown-kind fallback.
// @evidence contracts/testing.md#execution-ownership TestVerbatimReturnsEmptyForOutOfRangeNode is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
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
