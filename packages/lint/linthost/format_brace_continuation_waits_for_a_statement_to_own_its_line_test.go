package linthost

import "testing"

// TestFormatBraceContinuationWaitsForAStatementToOwnItsLine verifies a statement sharing its line pushes no keyword until it owns one.
//
// A statement that shares its line has no column of its own, and nothing would
// repair a keyword pushed to column zero: format/indent visits statement-list
// members, closing-brace lines, and member headers, and a continuation-keyword
// line is none of the three. Pushing anyway produced a dedented `else` that
// survived as ttsc format's own fixed point, so a later `ttsc check` blessed a
// shape Prettier rewrites.
//
//  1. Parse a one-line `if`/`else` that follows another statement on the same line.
//  2. Run format/brace-continuation.
//  3. Assert the rule reports nothing and leaves the split to a later pass.
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
