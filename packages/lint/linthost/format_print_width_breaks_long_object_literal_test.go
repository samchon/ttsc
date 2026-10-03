package linthost

import "testing"

// TestFormatPrintWidthBreaksLongObjectLiteral pins a complete object rewrite
// when its 34-column statement exceeds printWidth=20. Every key/value stays
// in order; indentation and the last-member comma distinguish a real layout
// correction from deletion or a skipped rewrite.
//
//  1. Reflow the three-property statement at width 20.
//  2. Compare the complete two-space vertical output.
//  3. Retain the same canonical statement at its exact width of 34.
//
// @evidence contracts/testing.md#behavioral-verification The rule must break the three-property object at width 20 without changing aa/bb/cc values or their order; the same source at width 34 must produce no finding.
// @evidence contracts/testing.md#independent-expectations The supported object-list layout breaks these three properties when their complete statement exceeds the budget. The authored statement has 34 columns including its semicolon; the silent boundary is counted from that input, not the rule's measurement.
// @evidence contracts/testing.md#distinguishing-cases Identical source at widths 20 and 34 distinguishes overflow from exact-fit behavior. The complete positive output pins indent, member separators and statement termination; the default-width host owns no-options 80/81 limits.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthBreaksLongObjectLiteral owns its configured rewrite and exact-fit negative through the in-process rule engine and literal source fixtures. It is a selected public Go unit, with no install, native build or product-host child.
func TestFormatPrintWidthBreaksLongObjectLiteral(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, bb: 2, cc: 3 };\n",
    `{"printWidth": 20}`,
    "const x = {\n  aa: 1,\n  bb: 2,\n  cc: 3,\n};\n",
  )
  assertRuleSkipsSourceWithOptions(t, "format/print-width", "const x = { aa: 1, bb: 2, cc: 3 };\n", `{"printWidth": 34}`)
}
