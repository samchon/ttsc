package linthost

import "testing"

// TestFormatClauseJoinSkipsCommentedElseGap verifies a comment between `else` and its body blocks the join.
//
// The gap walk stops at the first non-whitespace byte and requires the clause's
// own header token there, so a comment in the gap fails the anchor test rather
// than being swallowed by the rewrite. Prettier leaves the same source alone.
//
//  1. Parse an `else` whose body is preceded by a line comment.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing.
func TestFormatClauseJoinSkipsCommentedElseGap(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (ready) run();\nelse\n  // note\n  stop();\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
