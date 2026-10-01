package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornPreferNumberPropertiesChecksNaNWhenEnabled proves the opt-in NaN
// path reports with the substituted `Number.NaN` message.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution enables checkNaN and requires the global constant to report.
// @evidence contracts/testing.md#independent-expectations The supported option enables the Number.NaN preference independently of the default-off behavior.
// @evidence contracts/testing.md#distinguishing-cases Enabled NaN is reported; the default-options host owns the corresponding clean constant.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesChecksNaNWhenEnabled owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesChecksNaNWhenEnabled(t *testing.T) {
  source := "export {};\nconst value = NaN;\nvoid value;\n"
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    source,
    json.RawMessage(`{"checkNaN":true}`),
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
  if len(findings) != 1 || findings[0].Message != "Prefer `Number.NaN` over `NaN`." {
    t.Fatalf("checkNaN mismatch: %+v", findings)
  }
}
