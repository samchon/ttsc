package linthost

import "testing"

// TestFormatBraceContinuationPullsDoWhileOntoTheClosingBrace verifies a do-loop's `while` joins the closing brace of a block body.
//
// The `while` of a do-loop is a continuation keyword like `else`, not a loop
// header, and it is the one whose own statement kind differs from the clause it
// continues.
//
//  1. Parse a `do` whose `while` starts its own line after a block body.
//  2. Apply format/brace-continuation.
//  3. Assert `while` joins the closing brace line.
func TestFormatBraceContinuationPullsDoWhileOntoTheClosingBrace(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "do {\n  tick();\n}\nwhile (ready);\n",
    `{"tabWidth":2}`,
    "do {\n  tick();\n} while (ready);\n",
  )
}
