package linthost

import "testing"

// TestFormatBraceContinuationIndentsAPushedKeywordToItsStatement verifies a pushed-down keyword lands at its statement's column.
//
// The synthesized line break carries an indent, and taking it from the wrong
// place is invisible at top level, where the indent is empty. Nesting the
// statement is what makes a zero-column result wrong.
//
//  1. Parse a one-line `if`/`else` nested inside a function body.
//  2. Apply format/brace-continuation.
//  3. Assert `else` lands at the enclosing statement's column.
func TestFormatBraceContinuationIndentsAPushedKeywordToItsStatement(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/brace-continuation",
    "function f() {\n  if (a) x(); else y();\n}\n",
    `{"tabWidth":2}`,
    "function f() {\n  if (a) x();\n  else y();\n}\n",
  )
}
