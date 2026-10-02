package linthost

import "testing"

// TestFormatPrintWidthSkipsShortObjectLiteral verifies formatPrintWidth
// abstains when the flat form already fits the configured budget.
//
// "No diff → no edit" is the load-bearing invariant that keeps
// `ttsc format` idempotent. A rule that emitted an edit on every visit
// (even a noop edit) would either churn the cascade or expand into
// overlapping edits with other format rules. The case pins the abstain
// branch by feeding a short object that already conforms.
//
//  1. Configure default printWidth=80.
//  2. Feed `const x = { a: 1 };`.
//  3. Assert the rule reports zero findings — the rule has nothing to
//     say about a conforming literal.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the skips short object literal fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule reports zero findings — the rule has nothing to say about a conforming literal.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure default printWidth=80. The asserted decision is: Assert the rule reports zero findings — the rule has nothing to say about a conforming literal. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthSkipsShortObjectLiteral is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthSkipsShortObjectLiteral(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = { a: 1 };\n",
  )
}
