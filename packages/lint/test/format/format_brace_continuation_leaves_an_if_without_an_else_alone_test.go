package linthost

import "testing"

// TestFormatBraceContinuationLeavesAnIfWithoutAnElseAlone verifies a clause with no continuation keyword is untouched.
//
// The negative twin of every positive above: the rule only ever acts when a
// continuation keyword exists. An `if` with no alternate and a `try` with only a
// block have a closing brace and nothing after it, and a rule that scanned
// forward regardless would find the next statement's first token.
//
//  1. Parse an `if` with no `else` followed by another statement.
//  2. Run format/brace-continuation.
//  3. Assert the rule reports nothing.
func TestFormatBraceContinuationLeavesAnIfWithoutAnElseAlone(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n}\nrun();\n",
    `{"tabWidth":2}`,
  )
}
