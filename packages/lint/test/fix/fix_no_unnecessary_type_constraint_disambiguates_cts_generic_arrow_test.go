package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintDisambiguatesCTSGenericArrow verifies the
// explicit CommonJS TypeScript mode follows the generic-arrow comma contract.
func TestFixNoUnnecessaryTypeConstraintDisambiguatesCTSGenericArrow(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.cts",
    "const identity = <T extends unknown>(value: T): T => value;\n",
    "const identity = <T,>(value: T): T => value;\n",
  )
}
