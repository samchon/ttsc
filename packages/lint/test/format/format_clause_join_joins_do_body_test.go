package linthost

import "testing"

// TestFormatClauseJoinJoinsDoBody verifies a single-statement `do` body joins its `do` keyword.
//
// `KindDoStatement` was absent from the rule's visit set, so `do\n  tick();`
// survived every format pass while Prettier 3.8.3 writes `do tick();`. The `do`
// keyword is the clause's header token, the way `)` is for a `while`.
//
//  1. Parse a `do` loop whose body sits on the following line.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the body joins the `do` line and the `while` tail is untouched.
func TestFormatClauseJoinJoinsDoBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "do\n  tick();\nwhile (ready);\n",
    `{"printWidth":80,"tabWidth":2}`,
    "do tick();\nwhile (ready);\n",
  )
}
