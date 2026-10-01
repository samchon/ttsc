package linthost

import "testing"

// TestFormatPrintWidthKeepsEmptyArrayLiteralFlat verifies the rule
// abstains on an empty array literal regardless of the configured
// printWidth.
//
// The listShape printer special-cases empty children to `[]` with no
// internal whitespace, matching the empty-object case. If the rule
// attempted to reflow an empty array it would have no children to
// iterate over, which could trigger an out-of-bounds access or emit a
// no-op replacement that burns the idempotence check. The case pins
// the empty-array early-return at a tight printWidth so any regression
// that removes the guard is immediately visible.
//
//  1. Configure printWidth=1.
//  2. Feed `const x = [];`.
//  3. Assert the rule emits zero findings.
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
