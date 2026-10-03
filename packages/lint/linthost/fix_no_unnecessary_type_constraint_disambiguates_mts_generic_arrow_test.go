package linthost

import "testing"

// TestFixNoUnnecessaryTypeConstraintDisambiguatesMTSGenericArrow verifies the
// explicit ESM TypeScript mode follows the generic-arrow comma contract.
//
// @evidence contracts/testing.md#behavioral-verification Removing extends any from a single generic arrow in identity.mts retains the comma disambiguator.
// @evidence contracts/testing.md#independent-expectations The literal <T,> expectation follows the explicit ESM TypeScript grammar contract, preserving parameter and body text.
// @evidence contracts/testing.md#distinguishing-cases MTS differs from ordinary TS grammar; companion tests separately cover TS, CTS, TSX and already-unambiguous generic forms.
// @evidence contracts/testing.md#execution-ownership TestFixNoUnnecessaryTypeConstraintDisambiguatesMTSGenericArrow calls assertFixSnapshotFile with identity.mts and applies the real rule edits in process.
func TestFixNoUnnecessaryTypeConstraintDisambiguatesMTSGenericArrow(t *testing.T) {
  assertFixSnapshotFile(
    t,
    "typescript/no-unnecessary-type-constraint",
    "identity.mts",
    "const identity = <T extends any>(value: T): T => value;\n",
    "const identity = <T,>(value: T): T => value;\n",
  )
}
