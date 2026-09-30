package linthost

import "testing"

// TestFormatPrintWidthInsertsAfterObjectSpreadInValueLiteral is the
// over-suppression twin for the reflow: a preserved multi-line object VALUE
// literal ending in a spread (`{ a, ...o }`) must still gain its trailing
// comma when reflowed.
//
// The printer's rest-target suppression keys on assignment-target position,
// not on a trailing spread. A value-position spread is not a target, so the
// reflow honors trailingComma:"all" and appends the comma — proving the
// printer guard does not over-reach.
//
// 1. Feed an already-broken object value literal whose last member is a spread, no trailing comma.
// 2. Run formatPrintWidth at the default width (objectWrap keeps it expanded).
// 3. Assert the reflow adds the trailing comma after the spread.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the inserts after object spread in value literal fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the reflow adds the trailing comma after the spread.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Feed an already-broken object value literal whose last member is a spread, no trailing comma. The asserted decision is: Assert the reflow adds the trailing comma after the spread. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthInsertsAfterObjectSpreadInValueLiteral is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
func TestFormatPrintWidthInsertsAfterObjectSpreadInValueLiteral(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/print-width",
    "const merged = {\n  a,\n  ...o\n};\n",
    "const merged = {\n  a,\n  ...o,\n};\n",
  )
}
