package linthost

import "testing"

// TestDotNotationDeclinesFixWhenCommentInBracketSpan verifies the dot-notation
// autofix is withheld when a comment sits inside the `[…]` span it would splice
// over, so the comment survives instead of being silently deleted.
//
// The fix replaces the range from the receiver's end through the closing
// bracket, so a comment there (`p1 /* keep */ ["foo"]`) would vanish after
// `ttsc lint fix`. ESLint's dot-notation declines via `commentsExistBetween`;
// the port reports the diagnostic but offers no edit. The negative twin — the
// same access with no comment — must still rewrite, proving the guard is scoped
// to the comment and not a blanket suppression.
//
//  1. Report on a bracket access whose span carries a block comment.
//  2. Assert no fix is applied and the source is left byte-for-byte intact.
//  3. Assert the comment-free twin still collapses to dot notation.
func TestDotNotationDeclinesFixWhenCommentInBracketSpan(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "dot-notation",
    "const p1: any = {};\nconst v1 = p1 /* keep */ [\"foo\"];\nJSON.stringify(v1);\n",
  )
  assertFixSnapshot(
    t,
    "dot-notation",
    "const p2: any = {};\nconst v2 = p2[\"foo\"];\nJSON.stringify(v2);\n",
    "const p2: any = {};\nconst v2 = p2.foo;\nJSON.stringify(v2);\n",
  )
}
