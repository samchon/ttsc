package linthost

import "testing"

// TestFormatPrintWidthDeclinesLastArgHugAfterArrowLead verifies last-argument
// hugging declines when a leading argument is an arrow with an expression
// body. The supported two-argument arrow-and-array layout explodes the
// arguments rather than hugging the trailing array. This expression-body
// arrow carries no hard break, so the hard-break guard alone does not select
// that decision; the dedicated arrow-and-array shape guard does.
//
//  1. Parse a useMemo call whose first arg is an expression-body arrow and
//     last arg is an array, overflowing 80.
//  2. Apply format/print-width.
//  3. Assert both arguments explode onto their own lines.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the declines last arg hug after arrow lead fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert both arguments explode onto their own lines.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases One changing case where a leading expression-bodied arrow (which has no hard break) must still stop the trailing array from being hugged; the output explodes both arguments, whereas hugging would keep `[dependencyOneHere, ...]` on the call line.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthDeclinesLastArgHugAfterArrowLead is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthDeclinesLastArgHugAfterArrowLead(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "useMemo(() => computeExpensiveValueHere(), [dependencyOneHere, dependencyTwoHere]);\n",
    `{"printWidth":80,"tabWidth":2}`,
    "useMemo(\n  () => computeExpensiveValueHere(),\n  [dependencyOneHere, dependencyTwoHere],\n);\n",
  )
}
