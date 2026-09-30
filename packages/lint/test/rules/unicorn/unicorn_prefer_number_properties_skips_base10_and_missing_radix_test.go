package linthost

import (
  "testing"
)

// TestUnicornPreferNumberPropertiesSkipsBase10AndMissingRadix keeps the
// no-radix and base-10 parseInt calls valid while pinning the radix-2 twin so an
// over-eager relaxation of the filter is caught.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification The actual checker-backed rule accepts relaxed parseInt calls while its radix-2 counterpart must still report.
// @evidence contracts/testing.md#independent-expectations The supported no-radix/base-10 policy independently exempts those call forms without exempting other radix values.
// @evidence contracts/testing.md#distinguishing-cases Missing radix and explicit radix 10 are clean; explicit radix 2 is the reported adjacent boundary.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesSkipsBase10AndMissingRadix owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesSkipsBase10AndMissingRadix(t *testing.T) {
  for _, source := range []string{
    "export {};\nconst raw = \"10\";\nvoid parseInt(raw);\n",
    "export {};\nconst raw = \"10\";\nvoid parseInt(raw, 10);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
    assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
    if len(findings) != 0 {
      t.Fatalf("base-10 / no-radix parseInt must be valid, got %+v for %q", findings, source)
    }
  }
  source := "export {};\nconst raw = \"10\";\nvoid parseInt(raw, 2);\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("radix-2 parseInt must fire, got %+v", findings)
  }
}
