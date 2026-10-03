package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksTypeParamDefaultAfterEquals verifies a
// type parameter whose `extends C = Default` overflows breaks after `=`,
// hanging the default one level deeper, matching Prettier 3.
//
// The complete independent output requires both list explosion and the extra
// indentation after `=`. This direct case observes those edits, not a past
// benchmark result or an external formatter invocation.
//
//  1. Parse a class with one long defaulted type parameter (printWidth 50).
//  2. Apply format/declaration-header.
//  3. Assert the default hangs on the next line and the list explodes.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must break a long constrained defaulted type parameter after equals while preserving its constraint, DefaultType default and a=1 body.
// @evidence contracts/testing.md#independent-expectations The independently authored output literal places the default one extra indent deeper under width fifty without changing any generic or body token.
// @evidence contracts/testing.md#distinguishing-cases The changed one-parameter over-width default distinguishes a long default expression from the separately tested two-parameter list explosion and canonical-header negatives.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderBreaksTypeParamDefaultAfterEquals is selected by the lint semantic-unit Evidence claim as a public Go unit. The shared syntax-only harness calls the owning declaration-header rule on temporary fixture source and applies reported edits for the literal output assertion without consumer installation, native product build or a host process.
func TestFormatDeclarationHeaderBreaksTypeParamDefaultAfterEquals(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "class E<TVeryLongTypeParam extends SomeConstraint = DefaultType> {\n  a = 1;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
    "class E<\n  TVeryLongTypeParam extends SomeConstraint =\n    DefaultType,\n> {\n  a = 1;\n}\n",
  )
}
