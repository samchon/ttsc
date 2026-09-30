package linthost

import "testing"

// TestFormatPrintWidthBreaksArrayRestAssignmentTargetWithoutComma verifies
// the reflow breaks an overflowing array destructuring assignment target
// ending in a rest (`[a, ...rest] = arr`) WITHOUT appending a trailing comma.
//
// Arrays have no objectWrap:"preserve", so the suppression must be exercised
// through a genuine width-driven break: the flat form overflows printWidth,
// the reflow explodes it one element per line, and the printer's AddComma
// would otherwise put a comma after the AssignmentRestElement (a syntax
// error). The rest-target guard keeps the exploded shape valid.
//
// 1. Configure printWidth=20 and feed a single-line array rest target that overflows.
// 2. Run formatPrintWidth so the array breaks one element per line.
// 3. Assert the broken output has no trailing comma after the rest element.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the breaks array rest assignment target without comma fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the broken output has no trailing comma after the rest element.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=20 and feed a single-line array rest target that overflows. The asserted decision is: Assert the broken output has no trailing comma after the rest element. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthBreaksArrayRestAssignmentTargetWithoutComma is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthBreaksArrayRestAssignmentTargetWithoutComma(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "[alpha, ...restItems] = sourceArray;\n",
    `{"printWidth": 20}`,
    "[\n  alpha,\n  ...restItems\n] = sourceArray;\n",
  )
}
