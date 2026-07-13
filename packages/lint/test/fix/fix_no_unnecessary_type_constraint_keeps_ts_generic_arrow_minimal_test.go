package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintKeepsTSGenericArrowMinimal verifies an
// ordinary TS file does not receive a grammar-only trailing comma.
func TestFixNoUnnecessaryTypeConstraintKeepsTSGenericArrowMinimal(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.ts",
    "const identity = <T extends unknown>(value: T): T => value;\n",
    "const identity = <T>(value: T): T => value;\n",
  )
}
