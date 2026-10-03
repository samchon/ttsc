package linthost

import "testing"

// TestFormatPrintWidthKeepsEmptyArrayLiteralFlat verifies zero findings
// for an authored empty array at printWidth 1. The empty list renders
// as [] with no internal whitespace; this no-edit assertion does not
// observe which early return fired or prove guard-removal behavior.
//
//  1. Configure printWidth=1.
//  2. Feed `const x = [];`.
//  3. Assert the rule emits zero findings.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the keeps empty array literal flat fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule emits zero findings.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=1. The asserted decision is: Assert the rule emits zero findings. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthKeepsEmptyArrayLiteralFlat is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthKeepsEmptyArrayLiteralFlat(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = [];\n",
    `{"printWidth": 1}`,
  )
}
