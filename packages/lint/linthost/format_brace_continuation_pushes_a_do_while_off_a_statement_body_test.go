package linthost

import "testing"

// TestFormatBraceContinuationPushesADoWhileOffAStatementBody verifies a do-loop's `while` starts its own line when the body is not a block.
//
// The push-down twin for the do-loop. Its `while` carries the loop condition, so
// this full expected source requires a newline after the non-block body.
// Together with the block-body companion, it distinguishes the body-category
// policy from always joining the same `while` keyword.
//
//  1. Parse a one-line `do`/`while` with a statement body.
//  2. Apply format/brace-continuation.
//  3. Assert `while` moves to its own line.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must give while its own line when a do-loop body is a statement rather than a block.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves tick, ready and the terminating semicolon and changes only the gap before while to the supported statement-body newline.
// @evidence contracts/testing.md#distinguishing-cases This non-block do-loop positive complements the block do-loop pull-up, distinguishing the preceding body category instead of always joining while.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationPushesADoWhileOffAStatementBody is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationPushesADoWhileOffAStatementBody(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "do tick(); while (ready);\n",
    `{"tabWidth":2}`,
    "do tick();\nwhile (ready);\n",
  )
}
