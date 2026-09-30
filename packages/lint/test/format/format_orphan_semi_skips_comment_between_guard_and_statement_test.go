package linthost

import "testing"

// TestFormatOrphanSemiSkipsCommentBetweenGuardAndStatement verifies the
// rule abstains when a comment sits between the leading-semicolon guard and
// the statement it would protect. Gluing across the comment would move the
// `;` past it and reorder the trivia, so the rule leaves the gap alone.
//
//  1. Parse a semicolon guard separated by a block or line comment
//     from a parenthesis-leading statement.
//  2. Run format/orphan-semi under semi:false.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification The owning orphan-semi rule must report nothing when a block or line comment separates the guard and parenthesis-leading statement. The absence assertions prevent deleting or relocating comment trivia.
// @evidence contracts/testing.md#independent-expectations The supported safe merge only removes a whitespace gap; comment content is excluded and must remain in place. The no-finding oracle follows that ownership contract independently of the gap scanner.
// @evidence contracts/testing.md#distinguishing-cases The original block-comment negative remains and a line-comment negative is added. MergesGuardUnderNoSemi provides the adjacent whitespace-only positive with the same hazard direction.
// @evidence contracts/testing.md#execution-ownership TestFormatOrphanSemiSkipsCommentBetweenGuardAndStatement owns both literal comment fixtures in the public Go unit population. The owning syntax-only rule runs in process without consumer installation, native artifact building or an actual product host.
func TestFormatOrphanSemiSkipsCommentBetweenGuardAndStatement(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/orphan-semi",
    ";\n/* c */\n(bar as Baz).qux();\n",
    `{"semi":false}`,
  )
  assertRuleSkipsSourceWithOptions(t, "format/orphan-semi",
    ";\n// c\n(bar as Baz).qux();\n", `{"semi":false}`)
}
