package linthost

import "testing"

// TestFormatBraceContinuationWaitsForAStatementToOwnItsLine verifies this rule abstains when a statement shares its line.
//
// The prefix before `if` contains `foo();`, not just indentation or labels.
// braceContinuationIndent therefore declines to infer a column for `else`.
// The command-level companion owns the final split and placement; this direct
// rule case observes neither later passes nor another formatter's output.
//
//  1. Parse a one-line `if`/`else` that follows another statement on the same line.
//  2. Run format/brace-continuation.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/brace-continuation must emit no finding while an if shares its physical line with a preceding foo statement and has no independent indentation.
// @evidence contracts/testing.md#independent-expectations The fixed literal requires this single rule to preserve the shared-line source; its supported deferral policy leaves statement splitting to the cascade rather than inventing an incorrect else column.
// @evidence contracts/testing.md#distinguishing-cases This direct-rule negative is paired with the command-level shared-line cascade positive that proves eventual splitting and placement; the nested standalone-if positive owns a known nonzero column.
// @evidence contracts/testing.md#execution-ownership TestFormatBraceContinuationWaitsForAStatementToOwnItsLine is a public Go unit selected by the lint semantic-unit Evidence claim. This host owns its parsed literal sources and no-finding assertions; the shared syntax-only harness runs the owning rule in process without a consumer install, native product build or product host.
func TestFormatBraceContinuationWaitsForAStatementToOwnItsLine(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "function f() {\n  foo(); if (a) x(); else y();\n}\n",
    `{"tabWidth":2}`,
  )
}
