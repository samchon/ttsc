package linthost

import "testing"

// TestFormatClauseJoinChargesTheElseWidthBudgetAtItsLimit verifies the printWidth budget
// for an `else` clause is charged at its exact limit.
//
// `else stopEverything();` is 22 display columns. Prettier 3.8.3 joins it at
// printWidth 22 and leaves it broken at 21, so this case walks the boundary from
// both sides rather than picking a width comfortably past it. A budget measured
// from the enclosing `if` instead of the `else` keyword would charge the wrong
// column here.
//
//  1. Run format/clause-join on the same source at printWidth 22 and 21.
//  2. Assert the join lands at 22.
//  3. Assert nothing is reported at 21.
//
// @evidence contracts/testing.md#behavioral-verification The owning clause-join rule must join else stopEverything(); at width 22 and report nothing at 21; complete output and no-finding assertions detect charging the wrong anchor column.
// @evidence contracts/testing.md#independent-expectations The ASCII line else stopEverything(); has 22 columns, and installed Prettier 3.8.3 makes the same adjacent-width decision. Expected output retains the if branch and call spelling.
// @evidence contracts/testing.md#distinguishing-cases The identical else input is a positive at its exact limit and a negative one column below. Ordinary if joining is covered by JoinsSingleIfBody.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinChargesTheElseWidthBudgetAtItsLimit owns both literal width fixtures in the public Go unit population. The syntax-only harness executes the owning rule and applies edits in process without installing a consumer, building a native artifact or starting a product host.
func TestFormatClauseJoinChargesTheElseWidthBudgetAtItsLimit(t *testing.T) {
  const source = "if (ready) run();\nelse\n  stopEverything();\n"
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    source,
    `{"printWidth":22,"tabWidth":2}`,
    "if (ready) run();\nelse stopEverything();\n",
  )
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    source,
    `{"printWidth":21,"tabWidth":2}`,
  )
}
