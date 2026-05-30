package linthost

import "testing"

// TestFormatDeclarationHeaderAbstainsOnCommentInHeader verifies the rule
// abstains when the header carries a comment between the name and the
// opening brace. The element-by-element rebuild has no slot for that
// trivia, so reflowing would drop it; the rule leaves the source alone.
//
//  1. Parse an interface whose header holds a block comment and overflows.
//  2. Run format/declaration-header.
//  3. Assert the rule reports nothing.
func TestFormatDeclarationHeaderAbstainsOnCommentInHeader(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "interface Bbbbbbbbbbbb /* note */ extends FirstParentName, SecondParentName, Third {\n  a: number;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
  )
}
