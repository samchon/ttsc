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
//  2. Run format/clause-join at widths 80 and 120.
//  3. Assert no findings at 80 and the complete joined source at 120.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must return no findings for the long if body at width 80 and join the same source at width 120. The paired no-finding and complete-output assertions distinguish width enforcement from skipping every long-named call.
// @evidence contracts/testing.md#independent-expectations The literal ASCII header and call exceed 80 columns but fit 120. The supported width policy determines the opposite outcomes without computing expectations with the implementation width helper.
// @evidence contracts/testing.md#distinguishing-cases The original overflow negative remains and the identical input at a larger budget is an adjacent positive. ChargesTheElseWidthBudgetAtItsLimit owns the exact one-column transition for else.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinKeepsOverlongBodyBroken owns both width-option fixtures in the public Go unit population. The syntax-only owning rule and edit harness execute in process without a consumer install, native artifact build or actual product host.
func TestFormatClauseJoinKeepsOverlongBodyBroken(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (cond)\n  thisIsAVeryLongFunctionCallThatWouldExceedTheEightyColumnPrintWidthBudget();\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
  assertFixSnapshotWithOptions(t, "format/clause-join",
    "if (cond)\n  thisIsAVeryLongFunctionCallThatWouldExceedTheEightyColumnPrintWidthBudget();\n",
    `{"printWidth":120,"tabWidth":2}`,
    "if (cond) thisIsAVeryLongFunctionCallThatWouldExceedTheEightyColumnPrintWidthBudget();\n")
}
