package linthost

import "testing"

// TestFormatPrintWidthKeepsEmptyObjectLiteralFlat verifies an empty
// `{}` is never reflowed.
//
// The listShape printer special-cases empty children to `{}` with no
// internal whitespace. The case pins this branch: even at a tight
// printWidth, an empty object has nothing to reflow and the rule must
// emit zero findings.
//
//  1. Configure printWidth=1.
//  2. Feed `const x = {};`.
//  3. Assert the rule emits zero findings.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the keeps empty object literal flat fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule emits zero findings.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=1. The asserted decision is: Assert the rule emits zero findings. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthKeepsEmptyObjectLiteralFlat is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthKeepsEmptyObjectLiteralFlat(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = {};\n",
    `{"printWidth": 1}`,
  )
}
