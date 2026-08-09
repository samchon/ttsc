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
