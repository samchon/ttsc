package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintPreservesExistingTrailingComma verifies
// the fixer neither removes nor duplicates an existing TSX disambiguator.
//
// @evidence contracts/testing.md#behavioral-verification The TSX constraint fix removes extends unknown while retaining exactly the existing trailing comma.
// @evidence contracts/testing.md#independent-expectations The literal <T,> expected source detects either deletion or duplication of the independently supplied disambiguator.
// @evidence contracts/testing.md#distinguishing-cases An existing comma differs from the insertion-needed singleton TSX case.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintPreservesExistingTrailingComma calls assertFixSnapshotFile with identity.tsx and the actual type-constraint rule.
func TestFixNoUnnecessaryTypeConstraintPreservesExistingTrailingComma(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.tsx",
    "const identity = <T extends unknown,>(value: T): T => value;\n",
    "const identity = <T,>(value: T): T => value;\n",
  )
}
