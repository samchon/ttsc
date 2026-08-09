package linthost

import "testing"

// TestFormatBraceContinuationPullsElseOntoTheClosingBrace verifies `else` joins the closing brace of a block consequent.
//
// Nothing owned this boundary before, so an Allman-braced file survived every
// format pass unchanged while Prettier 3.8.3 writes `} else {`. This is the
// most common shape the gap produced (#1134).
//
//  1. Parse an `if`/`else` whose `else` starts its own line after a block.
//  2. Apply format/brace-continuation.
//  3. Assert `else` joins the closing brace line.
func TestFormatBraceContinuationPullsElseOntoTheClosingBrace(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n}\nelse {\n  y();\n}\n",
    `{"tabWidth":2}`,
    "if (a) {\n  x();\n} else {\n  y();\n}\n",
  )
}
