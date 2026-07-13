package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintPreservesExistingTrailingComma verifies
// the fixer neither removes nor duplicates an existing TSX disambiguator.
func TestFixNoUnnecessaryTypeConstraintPreservesExistingTrailingComma(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.tsx",
    "const identity = <T extends unknown,>(value: T): T => value;\n",
    "const identity = <T,>(value: T): T => value;\n",
  )
}
