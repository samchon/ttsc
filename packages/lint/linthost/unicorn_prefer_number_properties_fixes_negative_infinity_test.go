package linthost

import (
  "testing"
)

// TestUnicornPreferNumberPropertiesFixesNegativeInfinity proves the negated
// Infinity fix rewrites the whole unary to Number.NEGATIVE_INFINITY.
//
// 1. Run the authored negative Infinity fixture with checkInfinity enabled through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification Actual fix execution rewrites the whole negated global Infinity expression to the independently authored Number.NEGATIVE_INFINITY source.
// @evidence contracts/testing.md#independent-expectations The supported negative constant preference establishes the literal whole-unary replacement rather than adding a negation to the positive constant.
// @evidence contracts/testing.md#distinguishing-cases The full-source transform must remove the unary minus and use Number.NEGATIVE_INFINITY rather than negating Number.POSITIVE_INFINITY.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesFixesNegativeInfinity owns this literal negative Infinity fixture as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesFixesNegativeInfinity(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreferNumberPropertiesRuleName,
    "export {};\nconst negative = -Infinity;\nvoid negative;\n",
    `{"checkInfinity":true}`,
    "export {};\nconst negative = Number.NEGATIVE_INFINITY;\nvoid negative;\n",
  )
}
