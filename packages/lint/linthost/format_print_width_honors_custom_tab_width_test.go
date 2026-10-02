package linthost

import "testing"

// TestFormatPrintWidthHonorsCustomTabWidth verifies `tabWidth: 4`
// changes the per-indent column step.
//
// Prettier's default is 2; some teams use 4. The case asserts the
// per-indent step uses the configured value rather than a hardcoded 2.
//
//  1. Configure printWidth=20, tabWidth=4.
//  2. Feed `const x = { aa: 1, bb: 2, cc: 3 };`.
//  3. Assert the broken form indents children by 4 spaces.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the honors custom tab width fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the broken form indents children by 4 spaces.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The fixture is an overflowing one-line object at printWidth 20 with tabWidth 4, so the rule must break it and the only indentation unit that can satisfy the expected output is four spaces rather than the default two. The default-width two-space layout is owned by the sibling long-object test.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthHonorsCustomTabWidth is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthHonorsCustomTabWidth(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 20, "tabWidth": 4}`,
    "const x = {\n    aa: 1,\n    bb: 2,\n    cc: 3,\n};\n",
  )
}
