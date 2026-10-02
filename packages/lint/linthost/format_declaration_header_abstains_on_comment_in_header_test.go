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
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must emit no finding for an overflowing interface header carrying a block comment before extends, so its rebuilt header cannot discard the comment.
// @evidence contracts/testing.md#independent-expectations The independently authored note comment must remain associated with the interface header; width fifty cannot override the source-preservation guard.
// @evidence contracts/testing.md#distinguishing-cases This comment-bearing over-width negative complements the multi-type-interface positive reflow with unchanged member meaning; no transformed-output assertion is claimed here.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderAbstainsOnCommentInHeader is selected by the lint semantic-unit Evidence claim as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
func TestFormatDeclarationHeaderAbstainsOnCommentInHeader(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "interface Bbbbbbbbbbbb /* note */ extends FirstParentName, SecondParentName, Third {\n  a: number;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
  )
}
