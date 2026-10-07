package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintDisambiguatesCTSGenericArrow verifies the
// explicit CommonJS TypeScript mode follows the generic-arrow comma contract.
//
// @evidence contracts/testing.md#behavioral-verification Removing extends unknown from a single generic arrow in identity.cts retains the comma disambiguator.
// @evidence contracts/testing.md#independent-expectations The literal <T,> result follows the explicit CommonJS TypeScript grammar contract and leaves the arrow body unchanged.
// @evidence contracts/testing.md#distinguishing-cases CTS is selected by the real filename; TS, MTS, TSX, default and multiple-parameter boundaries each have companion tests.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintDisambiguatesCTSGenericArrow calls assertFixSnapshotFile with identity.cts and the actual type-constraint rule.
func TestFixNoUnnecessaryTypeConstraintDisambiguatesCTSGenericArrow(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.cts",
    "const identity = <T extends unknown>(value: T): T => value;\n",
    "const identity = <T,>(value: T): T => value;\n",
  )
}
