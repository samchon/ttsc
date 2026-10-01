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
// @evidence contracts/testing.md#behavioral-verification Runs format/print-width at printWidth 10 on `const x = { aa: 1, /* keep */ bb: 2 };` and requires zero findings so the comment is not dropped by a reflow.
// @evidence contracts/testing.md#independent-expectations The expected zero findings follows from the contract that reflow must never delete a comment between members; the source is an authored literal wide enough that a reflow would otherwise fire.
// @evidence contracts/testing.md#distinguishing-cases One abstention case with a block comment between object members; a comment at the list edge is owned by the trailing-block-comment test and comment-free reflow by the reflow tests.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls assertRuleSkipsSourceWithOptions, which runs the engine with the single rule on a temp-dir file; no child process, built binary or installed consumer.
func TestFormatPrintWidthAbstainsWhenInterMemberCommentPresent(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, /* keep */ bb: 2 };\n",
    `{"printWidth": 10}`,
  )
}
