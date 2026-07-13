package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintKeepsDefaultUnambiguous verifies a type
// parameter default already prevents the TSX generic-arrow ambiguity.
func TestFixNoUnnecessaryTypeConstraintKeepsDefaultUnambiguous(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "create.tsx",
    "const create = <T extends unknown = string>(value?: T): T | undefined => value;\n",
    "const create = <T = string>(value?: T): T | undefined => value;\n",
  )
}
