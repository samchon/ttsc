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
func TestFormatPrintWidthAbstainsWhenInterMemberCommentPresent(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const x = { aa: 1, /* keep */ bb: 2 };\n",
    `{"printWidth": 10}`,
  )
}
