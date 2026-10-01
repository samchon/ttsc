package linthost

import (
  "testing"
)

// TestUnicornPreferNumberPropertiesAutofixesIsNaNWithNumberArgument proves the
// otherwise suggestion-only isNaN autofixes when its sole argument is a number.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification The actual checker-backed fixer rewrites isNaN when its argument is provably numeric and compares the full authored source.
// @evidence contracts/testing.md#independent-expectations Global and Number.isNaN agree for number inputs; that independent semantic premise permits an automatic callee replacement.
// @evidence contracts/testing.md#distinguishing-cases The numeric argument owns the safe automatic edit; SuggestsUnsafeIsNaN owns an any-typed argument where coercion equivalence is not established.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesAutofixesIsNaNWithNumberArgument owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesAutofixesIsNaNWithNumberArgument(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    "export {};\nvoid isNaN(0);\n",
    "export {};\nvoid Number.isNaN(0);\n",
  )
}
