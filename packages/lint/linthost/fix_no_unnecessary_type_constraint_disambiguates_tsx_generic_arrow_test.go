package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintDisambiguatesTSXGenericArrow verifies a
// single TSX generic arrow keeps the comma that separates it from JSX syntax.
//
// @evidence contracts/testing.md#behavioral-verification The TSX generic-arrow fix removes the useless constraint and inserts a single comma to avoid JSX ambiguity.
// @evidence contracts/testing.md#independent-expectations The independently authored <T,> source is the required TSX disambiguation, retaining the value parameter and arrow body.
// @evidence contracts/testing.md#distinguishing-cases A singleton TSX parameter needs the comma; multiple parameters, defaults and existing commas have separate preserving cases.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintDisambiguatesTSXGenericArrow calls assertFixSnapshotFile with identity.tsx, selecting the actual JSX parser.
func TestFixNoUnnecessaryTypeConstraintDisambiguatesTSXGenericArrow(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.tsx",
    "const identity = <T extends unknown>(value: T): T => value;\n",
    "const identity = <T,>(value: T): T => value;\n",
  )
}
