package linthost

import "testing"

// TestFormatOrphanSemiSkipsCommentBetweenGuardAndStatement verifies the
// rule abstains when a comment sits between the leading-semicolon guard and
// the statement it would protect. Gluing across the comment would move the
// `;` past it and reorder the trivia, so the rule leaves the gap alone.
//
//  1. Parse a `;` guard, a block comment, then a `(`-leading statement.
//  2. Run format/orphan-semi under semi:false.
//  3. Assert the rule reports nothing.
func TestFormatOrphanSemiSkipsCommentBetweenGuardAndStatement(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/orphan-semi",
    ";\n/* c */\n(bar as Baz).qux();\n",
    `{"semi":false}`,
  )
}
