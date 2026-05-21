package linthost

import (
  "testing"
)

// TestDispatchBlockReturnsCoveredForNilNode verifies that printBlock returns
// an empty Doc and covered==true when called with a nil node.
//
// The nil guard is the first defensive check in printBlock. It protects
// callers — primarily printFunctionLike — from panicking when the function
// body pointer is nil due to a parse error. covered==true is correct: an
// empty Doc has no multi-line verbatim content. A regression that panicked
// or returned covered==false would break the printFunctionLike path that
// dispatches the body.
//
//  1. Build a PrintContext from any valid parsed file.
//  2. Call printBlock(ctx, nil) directly.
//  3. Assert the returned Doc is empty and covered is true.
func TestDispatchBlockReturnsCoveredForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := printBlock(ctx, nil)
  if !covered {
    t.Fatalf("printBlock(nil) should return covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("printBlock(nil) should produce empty output, got %q", got)
  }
}
