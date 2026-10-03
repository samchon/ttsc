package linthost

import "testing"

// TestFormatClauseJoinJoinsElseBody verifies a single-statement `else` body joins its `else` keyword line.
//
// The consequent uses the closing `)` anchor and the alternate uses `else`.
// Both newline gaps must join without changing the condition or either call.
// This direct snapshot observes those two joins, not historical rule behavior.
//
//  1. Parse an `if`/`else` whose branches both sit on the following line.
//  2. Apply format/clause-join with printWidth 80.
//  3. Assert both branches join their own header line.
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must join both the consequent and alternate to their own header lines. The complete output catches treating else as a parenthesis-headed clause or omitting the alternate.
// @evidence contracts/testing.md#independent-expectations The independently authored short-branch layout if (ready) run(); followed by else stop(); follows the supported clause policy. Conditions and both calls retain their spelling and order; external formatter output is not obtained by this body.
// @evidence contracts/testing.md#distinguishing-cases This positive combines the ) and else anchors in one if tree. The width-limit host, commented-gap host and empty/block hosts distinguish alternate cases where the rule must abstain.
// @evidence contracts/testing.md#execution-ownership TestFormatClauseJoinJoinsElseBody owns both branches in its public Go unit source fixture. The shared syntax-only harness executes the owning operation and applies edits in process without installation, native building or a product host.
func TestFormatClauseJoinJoinsElseBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/clause-join",
    "if (ready)\n  run();\nelse\n  stop();\n",
    `{"printWidth":80,"tabWidth":2}`,
    "if (ready) run();\nelse stop();\n",
  )
}
