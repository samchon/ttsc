package linthost

import "testing"

// TestPreferTemplateOffersWithheldTemplateAsSuggestion verifies the rendered
// template literal withheld from a seam-commented concatenation is offered as
// an opt-in suggestion that discards the seam comment.
//
// The native rebuild replaces the whole `+` chain with one literal and
// drops an operator-seam comment. Automatic fixing is withheld; the suggestion
// title discloses that loss, and this test applies the authored edits explicitly.
//
//  1. Report on `"hi " + /* keep */ who` and assert nothing auto-applies.
//  2. Assert the single suggestion yields the template literal `hi ${"" + (who)}`.
//  3. Assert the comment-free twin is still autofixed without asking.
//
// @evidence contracts/testing.md#behavioral-verification A seam-comment concatenation offers a titled opt-in lossy suggestion without an automatic edit; removing the comment permits automatic fixing.
// Every dynamic slot explicitly retains default-hint concatenation coercion.
//
// @evidence contracts/testing.md#independent-expectations Literal title explicitly discloses discarded comments and authored complete output fixes the intended value; the clean control independently permits the same rewrite.
// @evidence contracts/testing.md#distinguishing-cases Comment-bearing suggestion and comment-free automatic fix distinguish channels, not merely eventual output.
// @evidence contracts/testing.md#execution-ownership assertSuggestionSnapshot owns withheld automatic edits, the exact title and opt-in rewrite; assertFixSnapshot owns the comment-free automatic rewrite. Both authored invocations belong to this Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestPreferTemplateOffersWithheldTemplateAsSuggestion(t *testing.T) {
  assertSuggestionSnapshot(
    t,
    "prefer-template",
    "const who = \"world\";\nconst s = \"hi \" + /* keep */ who;\nJSON.stringify(s);\n",
    "Use a template literal, discarding the comments between the operands.",
    "const who = \"world\";\nconst s = `hi ${\"\" + (who)}`;\nJSON.stringify(s);\n",
  )
  assertFixSnapshot(
    t,
    "prefer-template",
    "const who = \"world\";\nconst s = \"hi \" + who;\nJSON.stringify(s);\n",
    "const who = \"world\";\nconst s = `hi ${\"\" + (who)}`;\nJSON.stringify(s);\n",
  )
}
