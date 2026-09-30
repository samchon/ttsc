package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintKeepsTSGenericArrowMinimal verifies an
// ordinary TS file does not receive a grammar-only trailing comma.
//
// @evidence contracts/testing.md#behavioral-verification The ordinary TS generic-arrow fix removes extends unknown and keeps <T> without a grammar-only comma.
// @evidence contracts/testing.md#independent-expectations Literal identity.ts and <T> expected source distinguish ordinary TS grammar from TSX/MTS/CTS expectations.
// @evidence contracts/testing.md#distinguishing-cases The identical singleton arrow shape receives different output under the companion explicit grammar filenames.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintKeepsTSGenericArrowMinimal calls assertFixSnapshotFile with identity.ts and applies real Engine edits.
func TestFixNoUnnecessaryTypeConstraintKeepsTSGenericArrowMinimal(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.ts",
    "const identity = <T extends unknown>(value: T): T => value;\n",
    "const identity = <T>(value: T): T => value;\n",
  )
}
