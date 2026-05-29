package linthost

import "testing"

// TestFormatClauseJoinKeepsOverlongBodyBroken verifies the rule does not
// join a body when the joined line would exceed printWidth.
//
// Prettier keeps an unbraced body on its own line when joining it would
// overflow the budget. The width guard must measure the would-be joined
// line and abstain, leaving the source untouched.
//
//  1. Parse an `if` whose body is too long to join under printWidth 80.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing.
func TestFormatClauseJoinKeepsOverlongBodyBroken(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (cond)\n  thisIsAVeryLongFunctionCallThatWouldExceedTheEightyColumnPrintWidthBudget();\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
