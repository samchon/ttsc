package linthost

import (
  "testing"
)

// TestUnicornPreferNumberPropertiesLeavesInfinityAndNaNUnderDefaults confirms
// both constants stay unchecked with the default options (both false).
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification The engine accepts Infinity and NaN when their corresponding checks are left at default-off settings.
// @evidence contracts/testing.md#independent-expectations The supported options independently disable these constants by default; silence is not inferred from current product output.
// @evidence contracts/testing.md#distinguishing-cases Both constant names remain clean under defaults; separate enabled-option hosts own their report counterparts.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesLeavesInfinityAndNaNUnderDefaults owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesLeavesInfinityAndNaNUnderDefaults(t *testing.T) {
  source := "export {};\nconst values = [Infinity, -Infinity, NaN];\nvoid values;\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
  if len(findings) != 0 {
    t.Fatalf("Infinity and NaN are off by default, got %+v", findings)
  }
}
