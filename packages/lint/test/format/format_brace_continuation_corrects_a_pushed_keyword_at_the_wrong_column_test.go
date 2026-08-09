package linthost

import "testing"

// TestFormatBraceContinuationCorrectsAPushedKeywordAtTheWrongColumn verifies a keyword already on its own line at the wrong column is corrected.
//
// The push-down direction owns the whole gap, not only the missing line break.
// Ceding the keyword's own column to format/indent left a stray indent standing
// forever, because that rule never visits a continuation-keyword line.
//
//  1. Parse an `if`/`else` whose `else` sits on its own line with a stray indent.
//  2. Apply format/brace-continuation.
//  3. Assert the keyword moves to the statement's column.
func TestFormatBraceContinuationCorrectsAPushedKeywordAtTheWrongColumn(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "if (a) x();\n   else y();\n",
    `{"tabWidth":2}`,
    "if (a) x();\nelse y();\n",
  )
}
