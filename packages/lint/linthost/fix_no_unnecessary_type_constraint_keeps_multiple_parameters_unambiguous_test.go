package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintKeepsMultipleParametersUnambiguous verifies
// a second type parameter already disambiguates the TSX generic arrow.
//
// @evidence contracts/testing.md#behavioral-verification The TSX fix removes T extends unknown while retaining the second U parameter and existing separating comma.
// @evidence contracts/testing.md#independent-expectations Literal <T, U> output preserves both parameters and tuple return/body independently of edit construction.
// @evidence contracts/testing.md#distinguishing-cases A second type parameter already disambiguates the arrow; singleton and default forms are separately owned.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintKeepsMultipleParametersUnambiguous calls assertFixSnapshotFile on pair.tsx in the Go process.
func TestFixNoUnnecessaryTypeConstraintKeepsMultipleParametersUnambiguous(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "pair.tsx",
    "const pair = <T extends unknown, U>(left: T, right: U): [T, U] => [left, right];\n",
    "const pair = <T, U>(left: T, right: U): [T, U] => [left, right];\n",
  )
}
