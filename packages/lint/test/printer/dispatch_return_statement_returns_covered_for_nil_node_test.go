package linthost

import (
  "testing"
)

// TestDispatchReturnStatementReturnsCoveredForNilNode verifies that
// printReturnStatement returns an empty Doc and covered==true when called
// with a nil node.
//
// The nil guard in printReturnStatement mirrors those in the arrow-function
// and expression-statement printers: a nil node must not panic. covered==true
// is returned because an empty Doc contributes no multi-line content to the
// enclosing Doc tree. A regression that returned covered==false would
// incorrectly taint a block's coverage flag through a nil statement
// placeholder during error-recovery parsing.
//
//  1. Build a PrintContext from any valid parsed file.
//  2. Call printReturnStatement(ctx, nil) directly.
//  3. Assert the returned Doc is empty and covered is true.
func TestDispatchReturnStatementReturnsCoveredForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := printReturnStatement(ctx, nil)
  if !covered {
    t.Fatalf("printReturnStatement(nil) should return covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("printReturnStatement(nil) should produce empty output, got %q", got)
  }
}
