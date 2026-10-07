package linthost

import "testing"

// TestFormatBraceContinuationPullsElseOntoTheClosingBrace verifies `else` joins the closing brace of a block consequent.
//
// The independently authored result requires the block continuation gap to
// become one space. This unit observes this rule's edit, not a former complete
// formatter run or a census of which input shape occurred most often.
//
//  1. Parse an `if`/`else` whose `else` starts its own line after a block.
//  2. Apply format/brace-continuation.
//  3. Assert `else` joins the closing brace line.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must join else onto the closing brace of its block consequent while preserving both branches.
// @evidence contracts/testing.md#independent-expectations The complete literal output preserves condition a and calls x/y and changes only the continuation gap to the independently specified } else shape.
// @evidence contracts/testing.md#distinguishing-cases This multiline pull-up positive complements the zero-width insertion and canonical joined negative; a statement-body positive owns the opposite direction.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationPullsElseOntoTheClosingBrace is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns the source and independent literal output; the shared syntax-only harness invokes the rule and applies its edits in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationPullsElseOntoTheClosingBrace(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n}\nelse {\n  y();\n}\n",
    `{"tabWidth":2}`,
    "if (a) {\n  x();\n} else {\n  y();\n}\n",
  )
}
