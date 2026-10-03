package linthost

import "testing"

// TestFixNoUselessEscapeDropsBackslash verifies the noUselessEscape
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
//
// @evidence contracts/testing.md#behavioral-verification no-useless-escape deletes the redundant backslash before c without altering the surrounding string or use.
// @evidence contracts/testing.md#independent-expectations The authored abcdef result follows cooked string equivalence for an ordinary letter escape; exact source equality catches oversized edits.
// @evidence contracts/testing.md#distinguishing-cases This ordinary useless ASCII escape is positive; digit, tagged-template and substitution escapes are retained in companion negative cases.
// @evidence contracts/testing.md#execution-ownership TestFixNoUselessEscapeDropsBackslash calls assertFixSnapshot with no-useless-escape and actual disk edit application.
func TestFixNoUselessEscapeDropsBackslash(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-useless-escape",
    "const v = \"ab\\cdef\";\nJSON.stringify(v);\n",
    "const v = \"abcdef\";\nJSON.stringify(v);\n",
  )
}
