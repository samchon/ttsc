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
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must give else its own line after the non-block x call consequent.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves condition a and x/y calls and replaces only the gap before else with the supported top-level newline.
// @evidence contracts/testing.md#distinguishing-cases This non-block else positive complements block-else pull-up and split canonical abstention; nested and wrong-column cases additionally distinguish owning indentation.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationPushesElseOffAStatementConsequent is a public Go unit selected by TestSelectedLintUnits. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationPushesElseOffAStatementConsequent(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) x(); else y();\n",
    `{"tabWidth":2}`,
    "if (a) x();\nelse y();\n",
  )
}
