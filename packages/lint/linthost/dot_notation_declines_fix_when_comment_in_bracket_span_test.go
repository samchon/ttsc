package linthost

import "testing"

// TestDotNotationDeclinesFixWhenCommentInBracketSpan verifies the dot-notation
// autofix is withheld when a comment sits inside the `[…]` span it would splice
// over, so the comment survives instead of being silently deleted.
//
// The fix replaces the range from the receiver's end through the closing
// bracket, so a comment there (`p1 /* keep */ ["foo"]`) would vanish after
// `ttsc lint fix`. ESLint's dot-notation guards with `commentsExistBetween`
// over the bracket pair; the port's splice starts at the receiver's end, so
// its guard covers that wider span. The port imposes no edit and routes the
// rewrite to the opt-in suggestion channel instead (pinned by
// `TestDotNotationOffersWithheldBracketCollapseAsSuggestion`). The twin with
// no comment must still rewrite, proving the guard is scoped to the comment
// and not a blanket suppression.
//
//  1. Run the rule on a bracket access whose span carries a block comment and
//     assert exactly one finding is reported.
//  2. Assert no fix is applied and the source is left byte-for-byte intact.
//  3. Assert the comment-free twin still collapses to dot notation.
//
// @evidence contracts/testing.md#behavioral-verification The rule must report but apply no edit to the commented bracket span, preserving every source byte; the comment-free twin must still fix.
// @evidence contracts/testing.md#independent-expectations The authored unchanged source and explicit p2.foo output independently distinguish safe edit ownership from deleting a comment without consent.
// @evidence contracts/testing.md#distinguishing-cases A comment between receiver and key suppresses automatic rewriting; its absent twin rewrites. The suggestion test separately owns the opt-in action.
// @evidence contracts/testing.md#execution-ownership TestDotNotationDeclinesFixWhenCommentInBracketSpan owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestDotNotationDeclinesFixWhenCommentInBracketSpan(t *testing.T) {
  commented := "const p1: any = {};\nconst v1 = p1 /* keep */ [\"foo\"];\nJSON.stringify(v1);\n"
  if _, _, findings := runRuleFindingsSnapshot(t, "dot-notation", commented, nil); len(findings) != 1 {
    t.Fatalf("dot-notation: findings = %d, want 1 (%+v)", len(findings), findings)
  }
  assertNoFixSnapshot(t, "dot-notation", commented)
  assertFixSnapshot(
    t,
    "dot-notation",
    "const p2: any = {};\nconst v2 = p2[\"foo\"];\nJSON.stringify(v2);\n",
    "const p2: any = {};\nconst v2 = p2.foo;\nJSON.stringify(v2);\n",
  )
}
