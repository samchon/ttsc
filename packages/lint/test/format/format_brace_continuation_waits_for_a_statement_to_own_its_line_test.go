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
func TestFormatBraceContinuationWaitsForAStatementToOwnItsLine(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "function f() {\n  foo(); if (a) x(); else y();\n}\n",
    `{"tabWidth":2}`,
  )
}
