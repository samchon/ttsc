package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchBlockCollapsesEmptyBodyToBraces verifies that printBlock
// renders a statement-free, comment-free block as `{}` and reports
// covered==true.
//
// An empty callback body `() => {}` is the simplest block shape. Because
// there are no statements and no trivia comment, there is nothing to drop
// or misformat on reflow, so the printer collapses the block to `{}` and
// marks it fully covered. A regression that emitted `{\n}` or returned
// covered==false would prevent the formatPrintWidth rule from accepting
// the empty body as a valid reflow target.
//
//  1. Parse `const f = () => {};`.
//  2. Dispatch the Block node through PrintNode directly.
//  3. Assert the output is `{}` and covered is true.
func TestDispatchBlockCollapsesEmptyBodyToBraces(t *testing.T) {
  file := parseTS(t, "const f = () => {};\n")
  node := firstNodeOfKind(t, file, shimast.KindBlock)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("empty block should be covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "{}" {
    t.Fatalf("empty block mismatch: want %q, got %q", "{}", got)
  }
}
