package linthost

import "testing"

// TestNoExtraBooleanCastOffersWithheldSpliceAsSuggestion verifies the cast
// removal withheld from `if (!/* c */!x)` is offered as an opt-in suggestion
// that drops the comment along with the bangs.
//
// The splice keeps only the inner operand's text, so imposing it would delete
// the comment silently — unacceptable for `ttsc fix`, which rewrites without
// asking. A suggestion is chosen by the author, so the same edit becomes safe
// to offer as long as its title says the comment goes with it. Discarding a
// correct edit instead is the loss this pins.
//
//  1. Report on `if (!/* c */!x)` and assert nothing is applied automatically.
//  2. Assert the single suggestion collapses the cast to `if (x)`.
//  3. Assert the comment-free twin is still autofixed without asking.
//
// @evidence contracts/testing.md#behavioral-verification Comment-discarding cast removal is available only as a titled suggestion while comment-free !! gets an automatic fix.
// @evidence contracts/testing.md#independent-expectations Literal title discloses discarded commentary, and independently authored whole outputs establish the intended branch-preserving splice.
// @evidence contracts/testing.md#distinguishing-cases Suggestion/no-autofix channel and clean automatic channel share the same boolean shape, isolating comment safety.
// @evidence contracts/testing.md#execution-ownership assertSuggestionSnapshot executes the comment-bearing no-extra-boolean-cast case, checking the title, opt-in output and absence of automatic edits. assertFixSnapshot owns the authored clean automatic-fix case in the same Test. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestNoExtraBooleanCastOffersWithheldSpliceAsSuggestion(t *testing.T) {
  assertSuggestionSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (!/* c */!x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "Remove the redundant cast, discarding the comment inside it.",
    "function f(x: any) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
  assertFixSnapshot(
    t,
    "no-extra-boolean-cast",
    "function f(x: any) {\n  if (!!x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
    "function f(x: any) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\nJSON.stringify(f);\n",
  )
}
