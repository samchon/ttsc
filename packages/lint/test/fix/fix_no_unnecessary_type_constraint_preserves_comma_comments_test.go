package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintPreservesCommaComments verifies comments
// after the removed constraint survive both inserted and existing commas.
func TestFixNoUnnecessaryTypeConstraintPreservesCommaComments(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "comments.tsx",
    "const first = <T extends unknown /* inserted comma */>(value: T): T => value;\n"+
      "const second = <U extends any /* existing comma */,>(value: U): U => value;\n",
    "const first = <T, /* inserted comma */>(value: T): T => value;\n"+
      "const second = <U /* existing comma */,>(value: U): U => value;\n",
  )
}
