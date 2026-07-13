package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintDisambiguatesTSXGenericArrow verifies a
// single TSX generic arrow keeps the comma that separates it from JSX syntax.
func TestFixNoUnnecessaryTypeConstraintDisambiguatesTSXGenericArrow(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.tsx",
    "const identity = <T extends unknown>(value: T): T => value;\n",
    "const identity = <T,>(value: T): T => value;\n",
  )
}
