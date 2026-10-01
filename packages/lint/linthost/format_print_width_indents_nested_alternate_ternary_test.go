package linthost

import "testing"

// TestFormatPrintWidthIndentsNestedAlternateTernary verifies an
// overflowing ternary chain breaks into Prettier 3's staircase, with the
// nested conditional in the alternate position indented one level deeper.
//
// `a ? b : c ? d : e` is a chain whose alternate is itself a conditional.
// Prettier 3 ("indent nested ternaries") breaks the whole chain together
// and steps the inner rungs in by tabWidth; the old verbatim fallback
// left the source flat or mis-aligned (Prettier 2 style).
//
//  1. Parse an over-width single-line ternary chain (printWidth 40).
//  2. Apply format/print-width.
//  3. Assert the staircase: outer rungs at indent 2, inner at indent 4.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the indents nested alternate ternary fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the staircase: outer rungs at indent 2, inner at indent 4.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Parse an over-width single-line ternary chain (printWidth 40). The asserted decision is: Assert the staircase: outer rungs at indent 2, inner at indent 4. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthIndentsNestedAlternateTernary is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthIndentsNestedAlternateTernary(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = aaaaaaaaaa ? bbbbbbbbbb : cccccccccc ? dddddddddd : eeeeeeeeee;\n",
    `{"printWidth":40,"tabWidth":2}`,
    "const x = aaaaaaaaaa\n  ? bbbbbbbbbb\n  : cccccccccc\n    ? dddddddddd\n    : eeeeeeeeee;\n",
  )
}
