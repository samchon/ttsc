package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintKeepsDefaultUnambiguous verifies a type
// parameter default already prevents the TSX generic-arrow ambiguity.
//
// @evidence contracts/testing.md#behavioral-verification The TSX generic-arrow fix retains T = string and removes extends unknown without adding a comma.
// @evidence contracts/testing.md#independent-expectations The literal default-bearing type parameter is independently unambiguous; expected output preserves optional value and return types.
// @evidence contracts/testing.md#distinguishing-cases A default already prevents JSX ambiguity, unlike the singleton no-default TSX arrow.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintKeepsDefaultUnambiguous calls assertFixSnapshotFile with create.tsx and the actual Engine rule.
func TestFixNoUnnecessaryTypeConstraintKeepsDefaultUnambiguous(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "create.tsx",
    "const create = <T extends unknown = string>(value?: T): T | undefined => value;\n",
    "const create = <T = string>(value?: T): T | undefined => value;\n",
  )
}
