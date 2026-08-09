package linthost

import "testing"

// TestFormatClauseJoinKeepsOverlongElseBodyBroken verifies an `else` body that would overflow printWidth stays broken.
//
// The width budget for the new clauses is measured from the `else` keyword's
// line, not the enclosing `if`, because that is the line Prettier would print.
// Measuring from the statement start would charge the wrong column and join a
// line that does not fit.
//
//  1. Parse an `else` whose single-statement body cannot fit a narrow printWidth.
//  2. Run format/clause-join with printWidth 20.
//  3. Assert the rule reports nothing.
func TestFormatClauseJoinKeepsOverlongElseBodyBroken(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (ready) run();\nelse\n  stopEverything();\n",
    `{"printWidth":20,"tabWidth":2}`,
  )
}
