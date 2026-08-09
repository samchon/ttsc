package linthost

import "testing"

// TestFormatClauseJoinJoinsElseIfChainAcrossLines verifies an `else` whose alternate is an `if` joins even when that `if` spans lines.
//
// Prettier prints an `else if` chain flat, so the alternate being an `if` is the
// second clause exempt from the single-line-body guard. Applying that guard here
// would leave `else` alone on its line and the chain permanently unjoined,
// because the inner `if` only becomes single-line on a later cascade pass.
//
//  1. Parse an `else` whose alternate is an `if` written across two lines.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert the chain collapses to `else if (b) y();`.
func TestFormatClauseJoinJoinsElseIfChainAcrossLines(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "if (a)\n  x();\nelse\n  if (b)\n    y();\n",
    `{"printWidth":80,"tabWidth":2}`,
    "if (a) x();\nelse if (b) y();\n",
  )
}
