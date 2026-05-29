package linthost

import "testing"

// TestFormatWhitespaceTrimsTrailingSpaces verifies formatWhitespace
// deletes spaces and tabs left before a line's newline.
//
// Trailing whitespace is invisible noise Prettier always strips. This
// pins operation (a): the run after the statement's `;` and before the
// `\n` is removed without touching the statement.
//
//  1. Parse a statement followed by two trailing spaces.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the trailing spaces are gone.
func TestFormatWhitespaceTrimsTrailingSpaces(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/whitespace",
    "const a = 1;  \nconst b = 2;\n",
    "const a = 1;\nconst b = 2;\n",
  )
}
