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
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the keeps object rest assignment target without comma fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert zero findings: the reflow leaves it untouched instead of adding a comma.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Feed an already-broken object rest assignment target with no trailing comma. The asserted decision is: Assert zero findings: the reflow leaves it untouched instead of adding a comma. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthKeepsObjectRestAssignmentTargetWithoutComma is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthKeepsObjectRestAssignmentTargetWithoutComma(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "({\n  ra,\n  ...rrest\n} = obj);\n",
  )
}
