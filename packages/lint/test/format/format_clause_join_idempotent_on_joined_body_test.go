package linthost

import "testing"

// TestFormatClauseJoinIdempotentOnJoinedBody verifies the rule abstains
// once the body already shares the header line.
//
// Idempotency keeps the format cascade converging: a joined `if (a) b();`
// has no newline in the header-to-body gap, so the rule must report
// nothing on a second pass.
//
//  1. Parse an already-joined `if`.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing.
func TestFormatClauseJoinIdempotentOnJoinedBody(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "if (a) b();\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
