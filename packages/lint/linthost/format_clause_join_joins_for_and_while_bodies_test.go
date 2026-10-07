package linthost

import "testing"

// TestFormatClauseJoinJoinsForAndWhileBodies verifies the join applies to
// the iteration statements (`for`, `while`) and not just `if`.
//
// All four iteration headers end in `)`, so they share the `if` join
// shape. Pinning `for` and `while` here guards against the Visits() set
// silently dropping a kind.
//
//  1. Parse for, while, for-in and for-of with next-line single bodies.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert all four bodies join their headers.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must join short bodies for ordinary for, while, for-in and for-of statements. Complete literal snapshots detect an omitted AST visit kind while preserving each header and call.
// @evidence contracts/testing.md#independent-expectations Each supported short iteration clause keeps its single controlled statement on the header line. Literal outputs change only the whitespace gap, independently of how visitation is implemented.
// @evidence contracts/testing.md#distinguishing-cases The original for and while positive fixtures remain, and adjacent for-in and for-of positives cover all four iteration forms. SkipsEmptyStatementBody owns empty for/while negatives.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinJoinsForAndWhileBodies owns both source snapshots and every loop fixture in the public Go unit population. The syntax-only harness executes the owning rule and edits in one process without installing a consumer, building native artifacts or starting a product host.
func TestFormatClauseJoinJoinsForAndWhileBodies(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "for (let i = 0; i < n; i++)\n  go(i);\nwhile (x)\n  tick();\n",
    `{"printWidth":80,"tabWidth":2}`,
    "for (let i = 0; i < n; i++) go(i);\nwhile (x) tick();\n",
  )
  assertFixSnapshotWithOptions(t, "format/clause-join",
    "for (const key in object)\n  visit(key);\nfor (const item of items)\n  visit(item);\n",
    `{"printWidth":80,"tabWidth":2}`,
    "for (const key in object) visit(key);\nfor (const item of items) visit(item);\n")
}
