package linthost

import "testing"

// TestFormatBraceContinuationPushesPastABraceTerminatedNonBlock verifies a consequent that ends in a brace but is not a block still pushes down.
//
// The one-property-away twin of every pull-up case. A `switch` consequent ends in
// `}` and Prettier still puts `else` on its own line, so a direction test that
// read the clause's last byte instead of its kind would join it and diverge.
//
//  1. Parse an `if` whose consequent is a `switch` statement, with `else` inline.
//  2. Apply format/brace-continuation.
//  3. Assert `else` moves to its own line rather than onto the closing brace.
func TestFormatBraceContinuationPushesPastABraceTerminatedNonBlock(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) switch (b) {\n} else y();\n",
    `{"tabWidth":2}`,
    "if (a) switch (b) {\n}\nelse y();\n",
  )
}
