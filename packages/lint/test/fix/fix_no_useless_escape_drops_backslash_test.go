package main

import "testing"

// TestFixNoUselessEscapeDropsBackslash verifies the no-useless-escape
// fixer deletes a redundant backslash inside a string literal.
//
// The detection scans the raw literal text; the fix is a single-byte
// deletion gated on the byte after the backslash being ASCII so multi-
// byte sequences cannot be corrupted. ESLint's own fixer uses the same
// shape.
//
// 1. Parse a string literal containing `\c` (no meaningful escape).
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the backslash is gone.
func TestFixNoUselessEscapeDropsBackslash(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-useless-escape",
    "const v = \"ab\\cdef\";\nJSON.stringify(v);\n",
    "const v = \"abcdef\";\nJSON.stringify(v);\n",
  )
}
