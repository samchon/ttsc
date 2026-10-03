package linthost

import (
  "testing"
)

// TestUnicornPreferNumberPropertiesExpandsShorthandFix proves the shorthand
// value is expanded to a full property so the fix stays valid syntax.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification The actual fix pipeline expands an object shorthand while preserving its original property key and replacing only the global value reference.
// @evidence contracts/testing.md#independent-expectations JavaScript object semantics require retaining the authored key when its value becomes a member expression; the full-source literal independently establishes that distinction.
// @evidence contracts/testing.md#distinguishing-cases The shorthand transform preserves the public key; ReportsObjectValuePositions also checks ordinary property initializer reporting.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesExpandsShorthandFix owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesExpandsShorthandFix(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    "export {};\nconst o = { parseInt };\nvoid o;\n",
    "export {};\nconst o = { parseInt: Number.parseInt };\nvoid o;\n",
  )
}
