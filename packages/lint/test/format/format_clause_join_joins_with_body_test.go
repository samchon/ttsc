package linthost

import "testing"

// TestFormatClauseJoinJoinsWithBody verifies a single-statement `with` body joins its header line.
//
// `with` is a `)`-headed clause Prettier joins like `while`, and it was simply
// missing from the visit set. The statement is rare and illegal in strict mode,
// which is exactly why nothing else in the corpus would have caught it.
//
//  1. Parse a `with` statement whose body sits on the following line.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the body joins the header line.
func TestFormatClauseJoinJoinsWithBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "with (scope)\n  run();\n",
    `{"printWidth":80,"tabWidth":2}`,
    "with (scope) run();\n",
  )
}
