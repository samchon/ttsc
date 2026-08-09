package linthost

import "testing"

// TestFormatBraceContinuationPullsFinallyOntoATryWithoutACatch verifies `finally` follows the try block when there is no catch.
//
// The `finally` keyword takes the try block as its preceding clause only when no
// catch clause exists, and every other case pins the catch-clause path instead.
// Without this the try-block fallback is unexercised.
//
//  1. Parse a `try`/`finally` with no catch clause and `finally` on its own line.
//  2. Apply format/brace-continuation.
//  3. Assert `finally` joins the try block's closing brace.
func TestFormatBraceContinuationPullsFinallyOntoATryWithoutACatch(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "try {\n  x();\n}\nfinally {\n  z();\n}\n",
    `{"tabWidth":2}`,
    "try {\n  x();\n} finally {\n  z();\n}\n",
  )
}
