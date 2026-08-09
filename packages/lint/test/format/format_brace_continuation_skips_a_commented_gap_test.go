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
func TestFormatBraceContinuationSkipsACommentedGap(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n}\n// note\nelse {\n  y();\n}\n",
    `{"tabWidth":2}`,
  )
}
