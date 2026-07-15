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
func TestFormatPrintWidthInsertsAfterObjectSpreadInValueLiteral(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/print-width",
    "const merged = {\n  a,\n  ...o\n};\n",
    "const merged = {\n  a,\n  ...o,\n};\n",
  )
}
