package linthost

import "testing"

// TestFormatBraceContinuationPushesADoWhileOffAStatementBody verifies a do-loop's `while` starts its own line when the body is not a block.
//
// The push-down twin for the do-loop. Its `while` carries the loop condition, so
// a direction test that keyed on the keyword rather than the preceding clause
// would treat it as a header and leave it inline.
//
//  1. Parse a one-line `do`/`while` with a statement body.
//  2. Apply format/brace-continuation.
//  3. Assert `while` moves to its own line.
func TestFormatBraceContinuationPushesADoWhileOffAStatementBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "do tick(); while (ready);\n",
    `{"tabWidth":2}`,
    "do tick();\nwhile (ready);\n",
  )
}
