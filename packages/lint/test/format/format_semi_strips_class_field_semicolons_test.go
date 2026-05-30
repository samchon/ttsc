package linthost

import "testing"

// TestFormatSemiStripsClassFieldSemicolons verifies semi:false removes
// the trailing `;` from newline-separated class fields.
//
// Class fields carry the full expression-ASI hazard set because their
// initializer is an expression, but plain identifier-named fields
// followed by another field (or `}`) are safe. Prettier drops their
// terminators under semi:false.
//
//  1. Parse a class with two semicolon-terminated fields.
//  2. Apply format/semi with prefer:"never".
//  3. Assert both field terminators are removed.
func TestFormatSemiStripsClassFieldSemicolons(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "class A {\n  a = 1;\n  b = 2;\n}\n",
    `{"prefer":"never"}`,
    "class A {\n  a = 1\n  b = 2\n}\n",
  )
}
