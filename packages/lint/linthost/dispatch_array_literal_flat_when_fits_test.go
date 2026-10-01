package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchArrayLiteralFlatWhenFits verifies short arrays stay on a
// single line with no bracket-internal whitespace.
//
// Array literals diverge from object literals on one detail: there is
// no leading/trailing space inside the brackets in flat mode. This
// case pins that convention; a regression that copy-pasted the object
// printer's `Space: true` would produce `[ a, b, c ]`.
//
//  1. Parse `const x = [1, 2, 3];`.
//  2. Render under default options.
//  3. Assert the array printed flat as `[1, 2, 3]`.
//
// @evidence contracts/testing.md#behavioral-verification printArrayLiteral must keep [1, 2, 3] on one line at the default width.
// @evidence contracts/testing.md#independent-expectations The authored compact array fits the eighty-column policy and retains each numeric value and comma.
// @evidence contracts/testing.md#distinguishing-cases The fitting list complements the width-twenty overflowing string-array case.
// @evidence contracts/testing.md#execution-ownership TestDispatchArrayLiteralFlatWhenFits is a plain top-level Go unit test, selectable with go test -run, that calls printArrayLiteral directly on a parsed numeric-array literal at the default width inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchArrayLiteralFlatWhenFits(t *testing.T) {
  file := parseTS(t, "const x = [1, 2, 3];\n")
  node := firstNodeOfKind(t, file, shimast.KindArrayLiteralExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printArrayLiteral(ctx, node)
  got := Print(doc, ctx.Opts)
  if got != "[1, 2, 3]" {
    t.Fatalf("flat array mismatch: %q", got)
  }
}
