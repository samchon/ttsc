package linthost

import "testing"

// TestFormatPrintWidthKeepsShortTernaryFlat verifies a ternary that fits
// printWidth is left on one line.
//
// The chain only breaks when its flat form overflows; a short ternary
// must stay flat so the rule does not gratuitously stairstep every
// `a ? b : c`. The fast path returns before the printer is even built.
//
//  1. Parse a short ternary that fits printWidth 40.
//  2. Run format/print-width.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the keeps short ternary flat fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule reports nothing.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Parse a short ternary that fits printWidth. The asserted decision is: Assert the rule reports nothing. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthKeepsShortTernaryFlat is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthKeepsShortTernaryFlat(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = a ? b : c;\n",
    `{"printWidth":40,"tabWidth":2}`,
  )
}
