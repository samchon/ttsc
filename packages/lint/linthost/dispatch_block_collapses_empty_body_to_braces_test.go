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
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must retain {} for an empty parsed block and report it covered.
// @evidence contracts/testing.md#independent-expectations The empty-block layout identity preserves both braces without introducing content or a line break.
// @evidence contracts/testing.md#distinguishing-cases The zero-statement block complements nonempty block reindentation and comment-only blocks that must remain uncovered.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockCollapsesEmptyBodyToBraces is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed empty block inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
