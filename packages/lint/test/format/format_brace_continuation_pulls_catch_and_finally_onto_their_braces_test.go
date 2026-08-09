package linthost

import "testing"

// TestFormatBraceContinuationPullsCatchAndFinallyOntoTheirBraces verifies `catch` and `finally` join the brace before them.
//
// `finally` is the case a node-kind test gets wrong: it follows a catch clause,
// which is not itself a block and always ends in one, so asking whether the
// preceding clause IS a block sends it down the push-down path and strands it on
// its own line.
//
//  1. Parse a `try` whose `catch` and `finally` each start their own line.
//  2. Apply format/brace-continuation.
//  3. Assert both keywords join the brace before them.
func TestFormatBraceContinuationPullsCatchAndFinallyOntoTheirBraces(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "try {\n  x();\n}\ncatch (error) {\n  y();\n}\nfinally {\n  z();\n}\n",
    `{"tabWidth":2}`,
    "try {\n  x();\n} catch (error) {\n  y();\n} finally {\n  z();\n}\n",
  )
}
