package linthost

import "testing"

// TestFormatClauseJoinSkipsCommentedElseGap verifies a comment between `else` and its body blocks the join.
//
// The gap walk stops at the first non-whitespace byte and requires the clause's
// own header token there, so a comment in the gap fails the anchor test rather
// than being swallowed by the rewrite. Prettier leaves the same source alone.
//
//  1. Parse else bodies preceded by a line comment and a block comment.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning clause-join rule must return no findings when either a line or block comment separates else from its body. The no-finding assertions prevent deleting comment content while rewriting a whitespace gap.
// @evidence contracts/testing.md#independent-expectations Comments in the clause gap are authored content rather than replaceable spacing. The supported anchor policy therefore requires abstention, independent of how the backward gap scanner is implemented.
// @evidence contracts/testing.md#distinguishing-cases The original line-comment negative remains and a block-comment negative covers the other comment token form. JoinsElseBody supplies the adjacent whitespace-only positive.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinSkipsCommentedElseGap owns both literal comment fixtures in the public Go unit population. The syntax-only harness directly executes the owning rule without a consumer install, native build or product host.
func TestFormatClauseJoinSkipsCommentedElseGap(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (ready) run();\nelse\n  // note\n  stop();\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
  assertRuleSkipsSourceWithOptions(t, "format/clause-join",
    "if (ready) run();\nelse\n  /* note */\n  stop();\n", `{"printWidth":80,"tabWidth":2}`)
}
