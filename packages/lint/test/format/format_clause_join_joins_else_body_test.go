package linthost

import "testing"

// TestFormatClauseJoinJoinsElseBody verifies a single-statement `else` body joins its `else` keyword line.
//
// The rule anchored on a header's closing `)`, which the `else` branch does not
// have, so it abstained where Prettier 3.8.3 writes `else stop();` (#1133). The
// anchor is now the clause's own header token.
//
//  1. Parse an `if`/`else` whose branches both sit on the following line.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert both branches join their own header line.
func TestFormatClauseJoinJoinsElseBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "if (ready)\n  run();\nelse\n  stop();\n",
    `{"printWidth":80,"tabWidth":2}`,
    "if (ready) run();\nelse stop();\n",
  )
}
