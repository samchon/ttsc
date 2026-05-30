package linthost

import "testing"

// TestFormatPrintWidthDeclinesLastArgHugAfterArrowLead verifies last-argument
// hugging declines when a leading argument is an arrow with an expression
// body. Prettier 3.8.3 never hugs after a function/arrow argument, so
// `useMemo(() => expr, [deps])` explodes every argument rather than hugging
// the trailing array. An expression-body arrow carries no hard break, so the
// hard-break guard alone misses it — the function/arrow guard catches it.
//
//  1. Parse a useMemo call whose first arg is an expression-body arrow and
//     last arg is an array, overflowing 80.
//  2. Apply format/print-width.
//  3. Assert both arguments explode onto their own lines.
func TestFormatPrintWidthDeclinesLastArgHugAfterArrowLead(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "useMemo(() => computeExpensiveValueHere(), [dependencyOneHere, dependencyTwoHere]);\n",
    `{"printWidth":80,"tabWidth":2}`,
    "useMemo(\n  () => computeExpensiveValueHere(),\n  [dependencyOneHere, dependencyTwoHere],\n);\n",
  )
}
