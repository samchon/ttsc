package linthost

import "testing"

// TestFormatPrintWidthAbstainsWhenInterMemberCommentPresent verifies
// the rule does NOT reflow a node that carries comments between its
// children.
//
// The v1 list printers join child docs with a freshly minted `,` and
// have no slot for inter-sibling trivia. Reflowing the literal would
// silently drop the comment — strictly worse than leaving the file
// alone. The rule's safety check `hasNonChildComments` detects the
// comment and abstains; the case feeds an object literal whose flat
// width is well over `printWidth` and asserts the rule emits zero
// findings.
//
//  1. Configure printWidth=10 (any non-trivial reflow would fire).
//  2. Feed `const x = { aa: 1, /* keep */ bb: 2 };`.
//  3. Assert the rule emits zero findings — the comment is preserved.
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule runs on the abstains when inter member comment present fixture and must report no findings, rejecting an unnecessary or unsafe edit rather than only comparing two formatter outputs. The owned result is: Assert the rule emits zero findings — the comment is preserved.
// @evidence contracts/testing.md#independent-expectations The literal unchanged input and zero-finding expectation follow the preservation boundary described above, independently of printer output. This host proves abstention, while changing fixtures in sibling rule tests prove formatting correctness.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=10 (any non-trivial reflow would fire). The asserted decision is: Assert the rule emits zero findings — the comment is preserved. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthAbstainsWhenInterMemberCommentPresent is one Go unit entry through the fixture parser and rule engine; its zero-findings assertion uses no installed consumer, formatter subprocess or native build.
func TestFormatPrintWidthAbstainsWhenInterMemberCommentPresent(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, /* keep */ bb: 2 };\n",
    `{"printWidth": 10}`,
  )
}
