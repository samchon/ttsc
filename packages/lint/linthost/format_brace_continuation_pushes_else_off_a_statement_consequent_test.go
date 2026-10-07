package linthost

import "testing"

// TestFormatBraceContinuationPushesElseOffAStatementConsequent verifies `else` starts its own line when the consequent is not a block.
//
// This exercises the non-block direction of the same gap operation. The full
// expected source requires a newline before `else`, in contrast to the block
// consequent's one-space target; it does not prescribe how many rules a
// different formatter architecture must use.
//
//  1. Parse a one-line `if`/`else` with a statement consequent.
//  2. Apply format/brace-continuation.
//  3. Assert `else` moves to its own line at the statement's indent.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must give else its own line after the non-block x call consequent.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves condition a and x/y calls and replaces only the gap before else with the supported top-level newline.
// @evidence contracts/testing.md#distinguishing-cases This non-block else positive complements block-else pull-up and split canonical abstention; nested and wrong-column cases additionally distinguish owning indentation.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationPushesElseOffAStatementConsequent is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationPushesElseOffAStatementConsequent(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) x(); else y();\n",
    `{"tabWidth":2}`,
    "if (a) x();\nelse y();\n",
  )
}
