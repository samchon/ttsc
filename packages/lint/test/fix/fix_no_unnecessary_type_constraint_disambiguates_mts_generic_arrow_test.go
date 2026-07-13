package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintDisambiguatesMTSGenericArrow verifies the
// explicit ESM TypeScript mode follows the generic-arrow comma contract.
func TestFixNoUnnecessaryTypeConstraintDisambiguatesMTSGenericArrow(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.mts",
    "const identity = <T extends any>(value: T): T => value;\n",
    "const identity = <T,>(value: T): T => value;\n",
  )
}
