package linthost

import "testing"

// TestFormatPrintWidthKeepsObjectRestAssignmentTargetWithoutComma verifies
// the reflow does not add a trailing comma when it keeps a multi-line object
// destructuring assignment target expanded (`({ a, ...rest } = obj)`).
//
// objectWrap:"preserve" keeps the newline-after-`{` object broken, and the
// printer's AddComma would append a comma after the rest under
// trailingComma:"all" — a syntax error. The printer must mirror the
// trailing-comma rule's rest-target suppression, so the already-valid,
// already-canonical source renders byte-identical and produces no finding.
//
// 1. Feed an already-broken object rest assignment target with no trailing comma.
// 2. Run formatPrintWidth at the default width.
// 3. Assert zero findings: the reflow leaves it untouched instead of adding a comma.
func TestFormatPrintWidthKeepsObjectRestAssignmentTargetWithoutComma(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "({\n  ra,\n  ...rrest\n} = obj);\n",
  )
}
