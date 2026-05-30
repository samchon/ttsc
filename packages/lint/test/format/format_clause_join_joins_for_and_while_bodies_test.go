package linthost

import "testing"

// TestFormatClauseJoinJoinsForAndWhileBodies verifies the join applies to
// the iteration statements (`for`, `while`) and not just `if`.
//
// All four iteration headers end in `)`, so they share the `if` join
// shape. Pinning `for` and `while` here guards against the Visits() set
// silently dropping a kind.
//
//  1. Parse a `for` and a `while` each with a next-line single body.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert both bodies join their headers.
func TestFormatClauseJoinJoinsForAndWhileBodies(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "for (let i = 0; i < n; i++)\n  go(i);\nwhile (x)\n  tick();\n",
    `{"printWidth":80,"tabWidth":2}`,
    "for (let i = 0; i < n; i++) go(i);\nwhile (x) tick();\n",
  )
}
