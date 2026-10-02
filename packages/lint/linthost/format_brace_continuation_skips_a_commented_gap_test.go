package linthost

import "testing"

// TestFormatBraceContinuationSkipsACommentedGap verifies a comment between a clause and its keyword blocks the move.
//
// The gap rewrite would delete the comment. The rule detects it by requiring the
// first non-whitespace byte after the clause to be the keyword itself, so a
// comment fails the match instead of being swallowed. Prettier leaves the same
// source alone.
//
//  1. Parse an `if`/`else` with a line comment between the brace and `else`.
//  2. Run format/brace-continuation.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must report no finding when either a line or block comment occupies the gap between a block and else.
// @evidence contracts/testing.md#independent-expectations The literal comments are source content rather than removable gap whitespace; zero findings prevents their deletion or relocation under the supported comment-preservation boundary.
// @evidence contracts/testing.md#distinguishing-cases The original line-comment negative remains and a block-comment negative is added; the uncommented block-else pull-up is the adjacent positive that distinguishes a comment guard from always refusing to join.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationSkipsACommentedGap is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its parsed literal sources and no-finding assertions; the shared syntax-only harness runs the owning rule in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationSkipsACommentedGap(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n}\n// note\nelse {\n  y();\n}\n",
    `{"tabWidth":2}`,
  )
  assertRuleSkipsSourceWithOptions(t, "format/brace-continuation", "if (a) {\n  x();\n} /* note */ else {\n  y();\n}\n", `{"tabWidth":2}`)
}
