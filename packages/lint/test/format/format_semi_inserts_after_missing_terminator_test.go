package linthost

import "testing"

// TestFormatSemiInsertsAfterMissingTerminator verifies formatSemi inserts a
// missing trailing semicolon on a simple expression statement.
//
// The rule must be a zero-width insertion at the statement's End position so
// the edit cannot collide with another rule's edit on the same line. This
// scenario pins the happy path: one ExpressionStatement with no trailing
// semicolon becomes the same statement with the terminator appended.
//
// 1. Parse a source file with one terminator-less expression statement.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the expected `;` at the new end.
func TestFormatSemiInsertsAfterMissingTerminator(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatSemi",
    "JSON.stringify(1)\n",
    "JSON.stringify(1);\n",
  )
}
