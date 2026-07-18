package linthost

import "testing"

// TestPreferTemplateOffersWithheldTemplateAsSuggestion verifies the rendered
// template literal withheld from a seam-commented concatenation is offered as
// an opt-in suggestion that discards the seam comment.
//
// The rebuild replaces the whole `+` chain with one literal, so a comment in
// an operator seam has nowhere to land and the autofix declines. Throwing the
// finished literal away was the waste: the renderer already produced the exact
// text the diagnostic is asking for, and only the imposition — not the
// rewrite — was ever unsafe.
//
//  1. Report on `"hi " + /* keep */ who` and assert nothing auto-applies.
//  2. Assert the single suggestion yields the template literal `hi ${who}`.
//  3. Assert the comment-free twin is still autofixed without asking.
func TestPreferTemplateOffersWithheldTemplateAsSuggestion(t *testing.T) {
  assertSuggestionSnapshot(
    t,
    "prefer-template",
    "const who = \"world\";\nconst s = \"hi \" + /* keep */ who;\nJSON.stringify(s);\n",
    "Use a template literal, discarding the comments between the operands.",
    "const who = \"world\";\nconst s = `hi ${who}`;\nJSON.stringify(s);\n",
  )
  assertFixSnapshot(
    t,
    "prefer-template",
    "const who = \"world\";\nconst s = \"hi \" + who;\nJSON.stringify(s);\n",
    "const who = \"world\";\nconst s = `hi ${who}`;\nJSON.stringify(s);\n",
  )
}
