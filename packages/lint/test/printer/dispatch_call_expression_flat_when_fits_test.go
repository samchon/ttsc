package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallExpressionFlatWhenFits verifies a short call
// expression renders on one line.
//
// Call expressions are the most common reflow target after object
// literals, so the per-node printer must stitch the callee verbatim
// onto the argument list shape without dropping or duplicating
// anything. The case pins the simplest flat shape: `foo(a, b)`.
//
//  1. Parse `foo(a, b);`.
//  2. Dispatch and print under default options.
//  3. Assert the result is `foo(a, b)`.
func TestDispatchCallExpressionFlatWhenFits(t *testing.T) {
  file := parseTS(t, "foo(a, b);\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  got := Print(printCallExpression(ctx, node), ctx.Opts)
  if got != "foo(a, b)" {
    t.Fatalf("flat call mismatch: %q", got)
  }
}
