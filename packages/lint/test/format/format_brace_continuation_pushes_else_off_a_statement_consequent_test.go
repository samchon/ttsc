package linthost

import "testing"

// TestFormatBraceContinuationPushesElseOffAStatementConsequent verifies `else` starts its own line when the consequent is not a block.
//
// The same decision read the other way. A rule that only pulled keywords up
// would leave `if (a) x(); else y();` on one line, which Prettier splits, so
// both directions have to belong to one owner or a source can satisfy neither.
//
//  1. Parse a one-line `if`/`else` with a statement consequent.
//  2. Apply format/brace-continuation.
//  3. Assert `else` moves to its own line at the statement's indent.
func TestFormatBraceContinuationPushesElseOffAStatementConsequent(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) x(); else y();\n",
    `{"tabWidth":2}`,
    "if (a) x();\nelse y();\n",
  )
}
