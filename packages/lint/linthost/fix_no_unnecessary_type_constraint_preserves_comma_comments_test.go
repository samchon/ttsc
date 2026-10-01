package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintPreservesCommaComments verifies comments
// after the removed constraint survive both inserted and existing commas.
//
// @evidence contracts/testing.md#behavioral-verification The TSX constraint fix preserves comments both when inserting a comma and when retaining an existing comma.
// @evidence contracts/testing.md#independent-expectations Two full literal arrow results retain the independently spelled inserted comma/existing comma comment payloads.
// @evidence contracts/testing.md#distinguishing-cases The first arrow lacks a disambiguator and the second already has one, detecting both comment loss and duplicate comma insertion.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintPreservesCommaComments calls assertFixSnapshotFile once on comments.tsx and owns both arrow results.
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
