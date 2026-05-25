package linthost

import (
  "testing"
)

// TestDispatchExpressionStatementReturnsCoveredForNilNode verifies that
// printExpressionStatement returns an empty Doc and covered==true when
// called with a nil node.
//
// The nil guard is the outermost safety net in printExpressionStatement. It
// must return covered==true so that a nil statement does not taint the
// enclosing block's coverage flag — there is nothing multi-line to worry
// about in empty output. A regression that returned covered==false would
// cause the formatPrintWidth rule to abstain on blocks that happen to hold
// a nil statement placeholder during error recovery.
//
//  1. Build a PrintContext from any valid parsed file.
//  2. Call printExpressionStatement(ctx, nil) directly.
//  3. Assert the returned Doc is empty and covered is true.
func TestDispatchExpressionStatementReturnsCoveredForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := printExpressionStatement(ctx, nil)
  if !covered {
    t.Fatalf("printExpressionStatement(nil) should return covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("printExpressionStatement(nil) should produce empty output, got %q", got)
  }
}
