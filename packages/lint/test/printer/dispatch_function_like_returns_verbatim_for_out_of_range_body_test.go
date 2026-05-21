package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchFunctionLikeReturnsVerbatimForOutOfRangeBody verifies that
// printFunctionLike falls back to verbatim when the node's position is
// synthesized (negative), triggering the `nodeStart < 0` guard.
//
// The guard `nodeStart < 0 || bodyStart < nodeStart || bodyStart > len(ctx.Source)`
// prevents a slice-out-of-bounds panic when a synthetic node (one created
// programmatically rather than by the parser) is passed to printFunctionLike.
// Synthetic nodes carry `Loc = UndefinedTextRange()` with pos=-1, end=-1.
// `SkipTrivia(src, -1)` returns -1 immediately (synthesized-position
// short-circuit), so `nodeStart = -1 < 0` trips the guard.
//
//  1. Create a synthetic ArrowFunction and Block via the node factory.
//     Both have Loc set to UndefinedTextRange() (pos=-1) by construction.
//  2. Build a PrintContext from a real parsed file.
//  3. Call printFunctionLike(ctx, syntheticArrow, syntheticBlock) directly.
//  4. Assert the function returns without panicking and produces an empty Doc.
func TestDispatchFunctionLikeReturnsVerbatimForOutOfRangeBody(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())

  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  // Synthetic nodes have Loc=UndefinedTextRange() → Pos()=-1.
  syntheticArrow := factory.NewArrowFunction(nil, nil, nil, nil, nil, nil, nil)
  syntheticBlock := factory.NewBlock(nil, false)

  // nodeStart = SkipTrivia(ctx.Source, -1) = -1 < 0 → guard fires.
  doc, covered := printFunctionLike(ctx, syntheticArrow, syntheticBlock)
  // verbatim of a synthetic node → empty Doc; covered = !nodeSpansMultipleLines
  // where the synthetic node has zero range → false → covered = true.
  if !covered {
    t.Fatalf("printFunctionLike with synthetic nodes should return covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("printFunctionLike with synthetic nodes should produce empty output, got %q", got)
  }
}
