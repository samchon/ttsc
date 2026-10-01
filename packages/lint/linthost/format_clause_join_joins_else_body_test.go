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
//
// @evidence contracts/testing.md#behavioral-verification Clause-join must join both the consequent and alternate to their own header lines. The complete output catches treating else as a parenthesis-headed clause or omitting the alternate.
// @evidence contracts/testing.md#independent-expectations The literal short-branch layout if (ready) run(); followed by else stop(); follows the supported clause policy and installed Prettier behavior. Conditions and both calls retain their spelling and order.
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
