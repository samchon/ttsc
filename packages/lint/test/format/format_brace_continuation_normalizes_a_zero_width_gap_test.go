package linthost

import "testing"

// TestFormatBraceContinuationNormalizesAZeroWidthGap verifies a keyword written flush against the brace gains its space.
//
// The empty gap is the boundary of the pull-up direction and the only input that
// produces a zero-width edit range, the shape the applier has dedicated coincident
// insert handling for.
//
//  1. Parse an `if`/`else` written as `}else{` with no gap at all.
//  2. Apply format/brace-continuation.
//  3. Assert one space appears between the brace and the keyword.
func TestFormatBraceContinuationNormalizesAZeroWidthGap(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) {\n  x();\n}else {\n  y();\n}\n",
    `{"tabWidth":2}`,
    "if (a) {\n  x();\n} else {\n  y();\n}\n",
  )
}
