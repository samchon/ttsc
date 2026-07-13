package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintKeepsMultipleParametersUnambiguous verifies
// a second type parameter already disambiguates the TSX generic arrow.
func TestFixNoUnnecessaryTypeConstraintKeepsMultipleParametersUnambiguous(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "pair.tsx",
    "const pair = <T extends unknown, U>(left: T, right: U): [T, U] => [left, right];\n",
    "const pair = <T, U>(left: T, right: U): [T, U] => [left, right];\n",
  )
}
