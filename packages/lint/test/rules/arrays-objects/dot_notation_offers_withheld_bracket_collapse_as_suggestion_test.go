package linthost

import "testing"

// TestDotNotationOffersWithheldBracketCollapseAsSuggestion verifies the
// bracket-to-dot rewrite withheld from a commented span is offered as an
// opt-in suggestion that discards the comment.
//
// The splice replaces everything from the receiver's end through the closing
// bracket, so `p1 /* keep */ ["foo"]` cannot be autofixed without erasing the
// comment. Withholding it from `ttsc fix` is right; withholding it from the
// author is not, because the collapse is exactly what the diagnostic asks for
// and the title tells them what the comment costs.
//
//  1. Report on `p1 /* keep */ ["foo"]` and assert nothing is auto-applied.
//  2. Assert the single suggestion collapses the access to `p1.foo`.
//  3. Assert the comment-free twin is still autofixed without asking.
func TestDotNotationOffersWithheldBracketCollapseAsSuggestion(t *testing.T) {
  assertSuggestionSnapshot(
    t,
    "dot-notation",
    "const p1: any = {};\nconst v1 = p1 /* keep */ [\"foo\"];\nJSON.stringify(v1);\n",
    "Use dot notation, discarding the comment inside the brackets.",
    "const p1: any = {};\nconst v1 = p1.foo;\nJSON.stringify(v1);\n",
  )
  assertFixSnapshot(
    t,
    "dot-notation",
    "const p2: any = {};\nconst v2 = p2[\"foo\"];\nJSON.stringify(v2);\n",
    "const p2: any = {};\nconst v2 = p2.foo;\nJSON.stringify(v2);\n",
  )
}
