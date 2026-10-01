package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchNewExpressionFlatWhenFits verifies the `new`-expression
// per-node printer keeps short constructions on a single line and
// preserves the `new ` keyword prefix.
//
// `printNewExpression` mirrors `printCallExpression` but prepends
// `new `. A regression that dropped the keyword would convert
// `new Foo(a)` to `Foo(a)` and silently change runtime semantics.
// The case pins the keyword and the flat-form shape end-to-end.
//
//  1. Parse `new Foo(a, b);`.
//  2. Dispatch the NewExpression node directly.
//  3. Assert the rendered output is `new Foo(a, b)`.
//
// @evidence contracts/testing.md#behavioral-verification printNewExpression must retain new Foo(a, b) flat at the default budget.
// @evidence contracts/testing.md#independent-expectations The authored short constructor fits and preserves new, target and argument order exactly.
// @evidence contracts/testing.md#distinguishing-cases A fitting constructor complements the narrow-budget broken list and malformed public argument fallback.
// @evidence contracts/testing.md#execution-ownership TestDispatchNewExpressionFlatWhenFits is a plain top-level Go unit test, selectable with go test -run, that calls printNewExpression directly on a parsed two-identifier new expression at the default width inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchNewExpressionFlatWhenFits(t *testing.T) {
  file := parseTS(t, "new Foo(a, b);\n")
  node := firstNodeOfKind(t, file, shimast.KindNewExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printNewExpression(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "new Foo(a, b)" {
    t.Fatalf("flat new expression mismatch: %q", got)
  }
}
