package linthost

import (
  "testing"
)

// TestDispatchArrowFunctionReturnsCoveredForNilNode verifies that
// printArrowFunction returns an empty Doc and covered==true when called
// with a nil node.
//
// The nil guard exists so callers that receive a nil pointer from the AST
// (e.g. a partially constructed node during error recovery) do not panic.
// covered==true is the correct signal: an empty Doc produces no output, and
// there is nothing multi-line to taint the enclosing coverage flag. A
// regression that panicked on nil or returned covered==false would cause
// the formatPrintWidth rule to abstain on every surrounding node.
//
//  1. Build a PrintContext from any valid parsed file.
//  2. Call printArrowFunction(ctx, nil) directly.
//  3. Assert the returned Doc is empty and covered is true.
func TestDispatchArrowFunctionReturnsCoveredForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := printArrowFunction(ctx, nil)
  if !covered {
    t.Fatalf("printArrowFunction(nil) should return covered=true, got false")
  }
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("printArrowFunction(nil) should produce empty output, got %q", got)
  }
}
