package linthost

import "testing"

// TestFormatPrintWidthPreservesBlankLineInReflowedCallbackBody verifies
// the rule keeps a user-authored blank line inside a hugged callback
// body instead of deleting it.
//
// The block printer uses fresh statement separators and preserves a
// single authored blank line. This direct rule assertion requires no
// finding on that layout; it does not execute an earlier revision or
// a full format pass, or separately compare a returned printer doc.
//
//  1. Feed a `new Singleton(() => { … })` whose body has a blank line
//     between two statements.
//  2. Run formatPrintWidth at the default width.
//  3. Assert the rule reports zero findings — the blank line survives.
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the preserves blank line in reflowed callback body fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule reports zero findings — the blank line survives.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Feed a `new Singleton(() => { … })` whose body has a blank line between two statements. The asserted decision is: Assert the rule reports zero findings — the blank line survives. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthPreservesBlankLineInReflowedCallbackBody is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthPreservesBlankLineInReflowedCallbackBody(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/print-width",
    "const x = new Singleton(() => {\n  setup();\n\n  teardown();\n});\n",
  )
}
